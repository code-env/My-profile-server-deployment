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
import { telegramService } from '../services/telegram.service';
import { User } from '../models/User';
import { IProfile } from '../interfaces/profile.interface';

/**
 * Handle Stripe webhook events
 */
export const handleStripeWebhook = async (req: Request, res: Response) => {
  logger.info('Received Stripe webhook event');
  const stripe = getStripe();
  const sig = req.headers['stripe-signature'];

  if (!sig || !stripeConfig.webhookSecret) {
    logger.error('Missing Stripe signature or webhook secret');
    return res.status(400).json({ success: false, message: 'Missing Stripe signature or webhook secret' });
  }

  logger.info('Verifying Stripe webhook signature');
  let event: Stripe.Event;

  try {
    // Verify the event came from Stripe
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      stripeConfig.webhookSecret
    );
    logger.info('Stripe webhook signature verified successfully', { eventType: event.type, eventId: event.id });

    // Log the event data for debugging
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.log('[WEBHOOK DEBUG] Payment intent ID:', paymentIntent.id);
      console.log('[WEBHOOK DEBUG] Payment intent metadata:', paymentIntent.metadata);
    }
  } catch (err: any) {
    logger.error(`Webhook signature verification failed: ${err.message}`);
    return res.status(400).json({ success: false, message: `Webhook Error: ${err.message}` });
  }

  // Handle the event
  try {
    logger.info(`Processing Stripe webhook event: ${event.type}`, { eventId: event.id });

    switch (event.type) {
      case 'payment_intent.succeeded':
        logger.info('Payment intent succeeded event received', {
          paymentIntentId: (event.data.object as Stripe.PaymentIntent).id
        });
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      case 'payment_intent.payment_failed':
        logger.info('Payment intent failed event received', {
          paymentIntentId: (event.data.object as Stripe.PaymentIntent).id
        });
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      case 'checkout.session.completed':
        logger.info('Checkout session completed event received', {
          sessionId: (event.data.object as Stripe.Checkout.Session).id
        });
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      // Add more event handlers as needed
      default:
        logger.info(`Unhandled event type: ${event.type}`, { eventId: event.id });
    }

    // Return a 200 response to acknowledge receipt of the event
    logger.info('Stripe webhook processed successfully', { eventType: event.type, eventId: event.id });
    res.json({ received: true });
  } catch (error) {
    logger.error('Error processing webhook event', { error, eventType: event.type, eventId: event.id });
    res.status(500).json({ success: false, message: 'Error processing webhook event' });
  }
};

/**
 * Handle payment intent succeeded event
 */
async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  logger.info('Payment intent succeeded', { paymentIntentId: paymentIntent.id });

  // Add these lines for debugging
  console.log('[WEBHOOK DEBUG] Payment intent ID:', paymentIntent.id);
  console.log('[WEBHOOK DEBUG] Payment intent metadata:', paymentIntent.metadata);

  // Find the transaction by reference ID (payment intent ID)
  const transaction = await MyPtsTransactionModel.findOne({
    referenceId: paymentIntent.id,
  });

  if (!transaction) {
    logger.error('Transaction not found for payment intent', { paymentIntentId: paymentIntent.id });

    // Try to find by metadata
    console.log('[WEBHOOK DEBUG] Trying to find transaction by metadata.paymentIntentId');
    const transactionByMetadata = await MyPtsTransactionModel.findOne({
      'metadata.paymentIntentId': paymentIntent.id
    });

    if (transactionByMetadata) {
      console.log('[WEBHOOK DEBUG] Found transaction by metadata:', transactionByMetadata._id.toString());
      return await processFoundTransaction(transactionByMetadata, paymentIntent);
    }

    return;
  }

  // Process the found transaction
  await processFoundTransaction(transaction, paymentIntent);

  // Create a helper function to process a found transaction
  async function processFoundTransaction(transaction: any, paymentIntent: Stripe.PaymentIntent) {
    console.log('[WEBHOOK DEBUG] Processing transaction:', transaction._id.toString());

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

      // Update MyPts balance
      myPts.balance += transaction.amount;
      myPts.lifetimeEarned += transaction.amount;
      myPts.lastTransaction = new Date();
      await myPts.save();
      console.log('[WEBHOOK DEBUG] Updated MyPts balance to:', myPts.balance);

      // Update the profile's myPtsBalance field and ProfileMypts fields to match the MyPts balance
      await ProfileModel.findByIdAndUpdate(profile._id, {
        myPtsBalance: myPts.balance,
        'ProfileMypts.currentBalance': myPts.balance,
        'ProfileMypts.lifetimeMypts': myPts.lifetimeEarned
      });
      console.log('[WEBHOOK DEBUG] Updated profile myPtsBalance and ProfileMypts to:', myPts.balance);

      // Move MyPts from holding to circulation
      const hub = await myPtsHubService.getHubState();
      console.log('[WEBHOOK DEBUG] Current hub holding:', hub.holdingSupply);

      // Always move from holding to circulation, regardless of available amount
      // This ensures we don't increase totalSupply unnecessarily
      const amountToMove = Math.min(transaction.amount, hub.holdingSupply);

      if (amountToMove > 0) {
        // Move available amount from holding to circulation
        console.log(`[WEBHOOK DEBUG] Moving ${amountToMove} MyPts from holding to circulation`);
        await myPtsHubService.moveFromHoldingToCirculation(
          amountToMove,
          `Purchase by profile ${profile._id}`,
          undefined,
          { profileId: profile._id, transactionId: transaction._id }
        );
      }

      // If we still need more MyPts (holding was insufficient)
      if (amountToMove < transaction.amount) {
        const remainingAmount = transaction.amount - amountToMove;
        console.log(`[WEBHOOK DEBUG] Holding supply insufficient. Issuing ${remainingAmount} additional MyPts`);

        // Issue the remaining amount needed
        await myPtsHubService.issueMyPts(
          remainingAmount,
          `Automatic issuance for purchase by profile ${profile._id} (holding insufficient)`,
          undefined,
          { automatic: true, profileId: profile._id }
        );

        // Move the newly issued MyPts to circulation
        await myPtsHubService.moveToCirculation(
          remainingAmount,
          `Moving newly issued MyPts to circulation for profile ${profile._id}`,
          undefined,
          { profileId: profile._id, transactionId: transaction._id }
        );
      }

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
}

/**
 * Handle payment intent failed event
 */
async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  logger.info('Payment intent failed', { paymentIntentId: paymentIntent.id });

  // Find the transaction by reference ID (payment intent ID)
  const transaction = await MyPtsTransactionModel.findOne({
    referenceId: paymentIntent.id,
  });

  if (!transaction) {
    logger.error('Transaction not found for payment intent', { paymentIntentId: paymentIntent.id });
    return;
  }

  // Update transaction status
  transaction.status = TransactionStatus.FAILED;
  await transaction.save();

  logger.info('Transaction status updated to FAILED', { transactionId: transaction._id });
}

/**
 * Handle checkout session completed event
 */
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  logger.info('Checkout session completed', { sessionId: session.id });

  // Extract metadata from the session
  const { profileId, myPtsAmount } = session.metadata || {};

  if (!profileId || !myPtsAmount) {
    logger.error('Missing required metadata in checkout session', { sessionId: session.id });
    return;
  }

  // Find the profile
  const profile = await ProfileModel.findById(profileId) as IProfile & { _id: mongoose.Types.ObjectId };
  if (!profile) {
    logger.error('Profile not found', { profileId });
    return;
  }

  // Get the MyPts document
  const myPts = await profile.getMyPts();

  // Update MyPts balance
  const amount = parseInt(myPtsAmount as string, 10);
  myPts.balance += amount;
  myPts.lifetimeEarned += amount;
  myPts.lastTransaction = new Date();
  await myPts.save();

  // Update the profile's myPtsBalance field and ProfileMypts fields to match the MyPts balance
  await ProfileModel.findByIdAndUpdate(profile._id, {
    myPtsBalance: myPts.balance,
    'ProfileMypts.currentBalance': myPts.balance,
    'ProfileMypts.lifetimeMypts': myPts.lifetimeEarned
  });
  logger.info('Updated profile myPtsBalance and ProfileMypts', {
    profileId: profile._id.toString(),
    myPtsBalance: myPts.balance,
    lifetimeMypts: myPts.lifetimeEarned
  });

  // Create transaction record
  const transaction = await MyPtsTransactionModel.create({
    profileId: profile._id,
    type: 'BUY_MYPTS',
    amount,
    balance: myPts.balance,
    description: `Bought ${amount} MyPts via Stripe Checkout`,
    status: TransactionStatus.COMPLETED,
    metadata: {
      checkoutSessionId: session.id,
      paymentIntentId: session.payment_intent,
    },
    referenceId: session.id,
  });

  // Move MyPts from holding to circulation
  const hub = await myPtsHubService.getHubState();
  logger.info('Current hub holding supply', { holdingSupply: hub.holdingSupply, amount });

  // Always move from holding to circulation, regardless of available amount
  // This ensures we don't increase totalSupply unnecessarily
  const amountToMove = Math.min(amount, hub.holdingSupply);

  if (amountToMove > 0) {
    // Move available amount from holding to circulation
    logger.info(`Moving ${amountToMove} MyPts from holding to circulation`);
    await myPtsHubService.moveFromHoldingToCirculation(
      amountToMove,
      `Purchase by profile ${profile._id}`,
      undefined,
      { profileId: (profile._id as unknown as mongoose.Types.ObjectId).toString(), transactionId: transaction._id.toString() }
    );
  }

  // If we still need more MyPts (holding was insufficient)
  if (amountToMove < amount) {
    const remainingAmount = amount - amountToMove;
    logger.info(`Holding supply insufficient. Issuing ${remainingAmount} additional MyPts`);

    // Issue the remaining amount needed
    await myPtsHubService.issueMyPts(
      remainingAmount,
      `Automatic issuance for purchase by profile ${profile._id} (holding insufficient)`,
      undefined,
      { automatic: true, profileId: (profile._id as unknown as mongoose.Types.ObjectId).toString() }
    );

    // Move the newly issued MyPts to circulation
    await myPtsHubService.moveToCirculation(
      remainingAmount,
      `Moving newly issued MyPts to circulation for profile ${profile._id}`,
      undefined,
      { profileId: (profile._id as unknown as mongoose.Types.ObjectId).toString(), transactionId: transaction._id.toString() }
    );
  }

  // Notify admins
  await notifyAdminsOfTransaction(transaction);

  // Notify the user of the completed transaction
  try {
    await notifyUserOfCompletedTransaction(transaction);
    logger.info('User notified of completed checkout transaction', {
      transactionId: transaction._id,
      profileId: transaction.profileId
    });
  } catch (notifyError) {
    logger.error('Error notifying user of completed checkout transaction', {
      error: notifyError,
      transactionId: transaction._id
    });
    // Continue even if notification fails
  }

  logger.info('MyPts purchase completed via checkout', {
    profileId,
    amount,
    transactionId: transaction._id,
  });
}
