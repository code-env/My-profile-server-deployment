import { Request, Response } from 'express';
import Stripe from 'stripe';
import mongoose from 'mongoose';
import { getStripe, stripeConfig } from '../config/stripe.config';
import { logger } from '../utils/logger';
import { MyPtsTransactionModel } from '../models/my-pts.model';
import { TransactionStatus } from '../interfaces/my-pts.interface';
import { ProfileModel } from '../models/profile.model';
import { myPtsHubService } from '../services/my-pts-hub.service';
import { notifyAdminsOfTransaction, notifyUserOfCompletedTransaction } from '../services/admin-notification.service';
import { IProfile } from '../interfaces/profile.interface';

/**
 * Handle payment intent succeeded event
 */
export async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  logger.info('Payment intent succeeded', { paymentIntentId: paymentIntent.id });

  // Add these lines for debugging
  console.log('[WEBHOOK DEBUG] Payment intent ID:', paymentIntent.id);
  console.log('[WEBHOOK DEBUG] Payment intent metadata:', paymentIntent.metadata);

  // Find the transaction by reference ID (payment intent ID)
  let transaction = await MyPtsTransactionModel.findOne({
    referenceId: paymentIntent.id,
  });

  // Add this for debugging
  console.log('[WEBHOOK DEBUG] Found transaction by referenceId:', transaction ? 'Yes' : 'No');

  if (!transaction) {
    // Try to find by metadata.paymentIntentId as a fallback
    console.log('[WEBHOOK DEBUG] Attempting to find by metadata...');
    const transactionByMetadata = await MyPtsTransactionModel.findOne({
      'metadata.paymentIntentId': paymentIntent.id
    });

    console.log('[WEBHOOK DEBUG] Found by metadata:', transactionByMetadata ? 'Yes' : 'No');

    if (transactionByMetadata) {
      console.log('[WEBHOOK DEBUG] Using transaction found by metadata');
      transaction = transactionByMetadata;
    } else {
      // Create a transaction if we have enough metadata in the payment intent
      if (paymentIntent.metadata && paymentIntent.metadata.profileId && paymentIntent.metadata.myPtsAmount) {
        console.log('[WEBHOOK DEBUG] Attempting to create missing transaction from payment metadata');
        try {
          const profileId = paymentIntent.metadata.profileId;
          const amount = parseInt(paymentIntent.metadata.myPtsAmount, 10);

          // Find the profile
          const profile = await ProfileModel.findById(profileId) as IProfile & { _id: mongoose.Types.ObjectId };
          if (!profile) {
            console.log('[WEBHOOK DEBUG] Profile not found, cannot create transaction');
            logger.error('Profile not found for metadata profileId', { profileId });
            return;
          }

          // Get current MyPts
          const myPts = await profile.getMyPts();
          console.log('[WEBHOOK DEBUG] Current profile MyPts balance:', myPts.balance);

          // Create transaction
          const newTransaction = await MyPtsTransactionModel.create({
            profileId: profile._id.toString(),
            type: 'BUY_MYPTS',
            amount,
            balance: myPts.balance + amount,
            description: paymentIntent.metadata.description || `Bought ${amount} MyPts`,
            status: 'PENDING', // Start as pending
            metadata: {
              paymentIntentId: paymentIntent.id,
              currency: paymentIntent.currency
            },
            referenceId: paymentIntent.id // Set reference ID for future lookups
          });

          console.log('[WEBHOOK DEBUG] Successfully created missing transaction:', newTransaction._id.toString());
          transaction = newTransaction;
        } catch (createError) {
          console.error('[WEBHOOK DEBUG] Error creating transaction:', createError);
        }
      }
    }

    // If we still don't have a transaction, log and exit
    if (!transaction) {
      // Log recent transactions for debugging
      const recentTransactions = await MyPtsTransactionModel.find()
        .sort({createdAt: -1})
        .limit(5);

      console.log('[WEBHOOK DEBUG] Recent transactions:',
        recentTransactions.map(t => {
          return {
            id: t._id.toString(),
            referenceId: t.referenceId,
            paymentIntentId: t.metadata?.paymentIntentId,
            status: t.status,
            profileId: t.profileId,
            createdAt: t.createdAt
          };
        })
      );

      logger.error('Transaction not found for payment intent', { paymentIntentId: paymentIntent.id });
      return;
    }
  }

  // Process the found transaction
  console.log('[WEBHOOK DEBUG] Processing found transaction:', transaction._id.toString());

  // Update transaction status if it's not already completed
  if (transaction.status !== TransactionStatus.COMPLETED) {
    console.log('[WEBHOOK DEBUG] Transaction status is not completed, updating...');

    // Get profile
    const profile = await ProfileModel.findById(transaction.profileId) as IProfile & { _id: mongoose.Types.ObjectId };
    if (!profile) {
      logger.error('Profile not found for transaction', {
        transactionId: transaction._id,
        profileId: transaction.profileId
      });
      console.log('[WEBHOOK DEBUG] Profile not found, aborting!', transaction.profileId);
      return;
    }
    console.log('[WEBHOOK DEBUG] Found profile:', profile._id.toString());

    // Get MyPts
    const myPts = await profile.getMyPts();
    console.log('[WEBHOOK DEBUG] Current MyPts balance:', myPts.balance);

    // Update transaction status
    transaction.status = TransactionStatus.COMPLETED;
    await transaction.save();
    console.log('[WEBHOOK DEBUG] Updated transaction status to COMPLETED');

    // Update MyPts balance directly
    myPts.balance += transaction.amount;
    myPts.lifetimeEarned += transaction.amount;
    myPts.lastTransaction = new Date();
    await myPts.save();
    console.log('[WEBHOOK DEBUG] Updated MyPts balance to:', myPts.balance);

    // Update the profile document to keep it in sync
    try {
      const result = await ProfileModel.findByIdAndUpdate(profile._id, {
        myPtsBalance: myPts.balance,
        'ProfileMypts.currentBalance': myPts.balance,
        'ProfileMypts.lifetimeMypts': myPts.lifetimeEarned
      }, { new: true });

      console.log('[WEBHOOK DEBUG] Profile update result:', {
        id: result?._id,
        myPtsBalance: result?.myPtsBalance,
        currentBalance: result?.ProfileMypts?.currentBalance,
        lifetimeMypts: result?.ProfileMypts?.lifetimeMypts
      });
    } catch (error) {
      console.error('[WEBHOOK DEBUG] Error updating profile document:', error);
      // Don't throw the error to avoid disrupting the main transaction
    }

    console.log('[WEBHOOK DEBUG] Updated profile myPtsBalance and ProfileMypts to:', myPts.balance);

    // Move MyPts from reserve to circulation
    const hub = await myPtsHubService.getHubState();
    console.log('[WEBHOOK DEBUG] Current hub reserve:', hub.reserveSupply);

    // Check if there is enough in reserve
    if (hub.reserveSupply < transaction.amount) {
      // If not enough in reserve, issue more MyPts
      console.log('[WEBHOOK DEBUG] Not enough in reserve, issuing more...');
      await myPtsHubService.issueMyPts(
        transaction.amount - hub.reserveSupply,
        `Automatic issuance for purchase by profile ${profile._id}`,
        undefined,
        { automatic: true, profileId: profile._id }
      );
    }

    // Move from reserve to circulation
    console.log('[WEBHOOK DEBUG] Moving MyPts from reserve to circulation');
    await myPtsHubService.moveToCirculation(
      transaction.amount,
      `Purchase by profile ${profile._id}`,
      undefined,
      { profileId: profile._id, transactionId: transaction._id }
    );

    // Notify admins
    console.log('[WEBHOOK DEBUG] Notifying admins of transaction');
    await notifyAdminsOfTransaction(transaction);

    // Notify the user of the completed transaction
    try {
      console.log('[WEBHOOK] About to call notifyUserOfCompletedTransaction for transaction:', transaction._id);
      logger.info('[WEBHOOK] About to call notifyUserOfCompletedTransaction', {
        transactionId: transaction._id,
        profileId: transaction.profileId,
        transactionType: transaction.type,
        amount: transaction.amount
      });

      await notifyUserOfCompletedTransaction(transaction);

      console.log('[WEBHOOK] Successfully called notifyUserOfCompletedTransaction for transaction:', transaction._id);
      logger.info('[WEBHOOK] User notified of completed transaction', {
        transactionId: transaction._id,
        profileId: transaction.profileId
      });
    } catch (notifyError) {
      console.log('[WEBHOOK] Error calling notifyUserOfCompletedTransaction:', notifyError);
      logger.error('[WEBHOOK] Error notifying user of completed transaction', {
        error: notifyError,
        transactionId: transaction._id
      });
      // Continue even if notification fails
    }

    console.log('[WEBHOOK DEBUG] Transaction processing complete!');
  } else {
    console.log('[WEBHOOK DEBUG] Transaction already completed, skipping processing');
  }
}
