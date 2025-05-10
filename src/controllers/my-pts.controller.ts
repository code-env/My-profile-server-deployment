import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { MyPtsModel, MyPtsTransactionModel } from '../models/my-pts.model';
import { ProfileModel } from '../models/profile.model';
import { TransactionType, TransactionStatus } from '../interfaces/my-pts.interface';
import { myPtsHubService } from '../services/my-pts-hub.service';
import { logger } from '../utils/logger';
import { IProfile } from '../interfaces/profile.interface';
import { notifyAdminsOfTransaction, notifyUserOfCompletedTransaction } from '../services/admin-notification.service';
import { NotificationService } from '../services/notification.service';
import EmailService from '../services/email.service';
import { User } from '../models/User';

/**
 * Get MyPts balance for the authenticated profile
 */
export const getMyPtsBalance = async (req: Request, res: Response) => {
  try {
    if (!req.profile) {
      return res.status(401).json({ success: false, message: 'Profile not authenticated' });
    }

    const profile = req.profile as any;

    // Get MyPts directly from the model instead of using the profile method
    const myPts = await MyPtsModel.findOne({ profileId: profile._id }) ||
      await MyPtsModel.create({
        profileId: profile._id,
        balance: profile.ProfileMypts?.currentBalance || 0,
        lifetimeEarned: profile.ProfileMypts?.lifetimeMypts || 0,
        lifetimeSpent: 0,
        lastTransaction: new Date()
      });

    // Get currency from query parameter, default to USD
    const currency = req.query.currency as string || 'USD';

    // Create value information object
    const valueInfo = {
      balance: myPts.balance,
      valuePerPts: 0.024, // Default base value
      currency: currency,
      symbol: currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency,
      totalValue: myPts.balance * 0.024,
      formattedValue: `${currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency}${(myPts.balance * 0.024).toFixed(2)}`
    };

    return res.status(200).json({
      success: true,
      data: {
        balance: myPts.balance,
        lifetimeEarned: myPts.lifetimeEarned,
        lifetimeSpent: myPts.lifetimeSpent,
        lastTransaction: myPts.lastTransaction,
        value: {
          valuePerMyPt: valueInfo.valuePerPts,
          currency: valueInfo.currency,
          symbol: valueInfo.symbol,
          totalValue: valueInfo.totalValue,
          formattedValue: valueInfo.formattedValue
        }
      }
    });
  } catch (error: any) {
    logger.error(`Error getting MyPts balance: ${error.message}`, { error });
    return res.status(500).json({ success: false, message: 'Failed to get MyPts balance' });
  }
};

/**
 * Force refresh MyPts balance for the authenticated profile
 * This is useful after a payment to ensure the balance is up-to-date
 */
export const refreshMyPtsBalance = async (req: Request, res: Response) => {
  try {
    if (!req.profile) {
      return res.status(401).json({ success: false, message: 'Profile not authenticated' });
    }

    const profile = req.profile as IProfile;
    const profileId = profile._id as unknown as mongoose.Types.ObjectId;
    logger.info(`Force refreshing MyPts balance for profile: ${profileId}`);

    // Get the latest transaction for this profile
    const latestTransaction = await MyPtsTransactionModel.findOne({
      profileId: profileId.toString()
    }).sort({ createdAt: -1 });

    // Get MyPts directly from the model
    const myPts = await MyPtsModel.findOne({ profileId: profileId.toString() });

    if (!myPts) {
      logger.error(`MyPts record not found for profile: ${profileId}`);
      return res.status(404).json({ success: false, message: 'MyPts record not found' });
    }

    // Get currency from query parameter, default to USD
    const currency = req.query.currency as string || 'USD';

    // Get the current value information
    const valueInfo = await profile.getMyPtsValue(currency);

    // Update both the profile's myPtsBalance field and ProfileMypts.currentBalance to match the MyPts balance
    await ProfileModel.findByIdAndUpdate(profileId, {
      myPtsBalance: myPts.balance,
      'ProfileMypts.currentBalance': myPts.balance,
      'ProfileMypts.lifetimeMypts': myPts.lifetimeEarned
    });

    logger.info(`Refreshed MyPts balance for profile: ${profileId}`, {
      balance: myPts.balance,
      latestTransactionId: latestTransaction?._id,
      latestTransactionStatus: latestTransaction?.status
    });

    return res.status(200).json({
      success: true,
      data: {
        balance: myPts.balance,
        lifetimeEarned: myPts.lifetimeEarned,
        lifetimeSpent: myPts.lifetimeSpent,
        lastTransaction: myPts.lastTransaction,
        latestTransactionId: latestTransaction?._id,
        latestTransactionStatus: latestTransaction?.status,
        value: {
          valuePerMyPt: valueInfo.valuePerPts,
          currency: valueInfo.currency,
          symbol: valueInfo.symbol,
          totalValue: valueInfo.totalValue,
          formattedValue: valueInfo.formattedValue
        }
      }
    });
  } catch (error: any) {
    logger.error(`Error refreshing MyPts balance: ${error.message}`, { error });
    return res.status(500).json({ success: false, message: 'Failed to refresh MyPts balance' });
  }
};

/**
 * Get transaction history for the authenticated profile
 */
export const getTransactionHistory = async (req: Request, res: Response) => {
  try {
    if (!req.profile) {
      return res.status(401).json({ success: false, message: 'Profile not authenticated' });
    }

    const profile = req.profile as unknown as IProfile;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

    // Get transactions directly from the model
    const profileId = profile._id as unknown as mongoose.Types.ObjectId;
    const transactions = await MyPtsTransactionModel.find({ profileId: profileId.toString() })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit);

    // Get total count for pagination
    const totalCount = await MyPtsTransactionModel.countDocuments({ profileId: profileId.toString() });

    return res.status(200).json({
      success: true,
      data: {
        transactions,
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: offset + transactions.length < totalCount
        }
      }
    });
  } catch (error: any) {
    logger.error(`Error getting transaction history: ${error.message}`, { error });
    return res.status(500).json({ success: false, message: 'Failed to get transaction history' });
  }
};

/**
 * Get transactions by type for the authenticated profile
 */
export const getTransactionsByType = async (req: Request, res: Response) => {
  try {
    if (!req.profile) {
      return res.status(401).json({ success: false, message: 'Profile not authenticated' });
    }

    const profile = req.profile as unknown as IProfile;
    const { type } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

    // Validate transaction type
    if (!Object.values(TransactionType).includes(type as TransactionType)) {
      return res.status(400).json({ success: false, message: 'Invalid transaction type' });
    }

    const profileId = (profile._id as unknown as mongoose.Types.ObjectId).toString();

    // Get transactions directly from the model
    const transactions = await MyPtsTransactionModel.find({
      profileId: profileId,
      type: type as TransactionType
    })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit);

    // Get total count for pagination
    const totalCount = await MyPtsTransactionModel.countDocuments({
      profileId: (profile._id as unknown as mongoose.Types.ObjectId).toString(),
      type: type
    });

    return res.status(200).json({
      success: true,
      data: {
        transactions,
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: offset + transactions.length < totalCount
        }
      }
    });
  } catch (error: any) {
    logger.error(`Error getting transactions by type: ${error.message}`, { error });
    return res.status(500).json({ success: false, message: 'Failed to get transactions by type' });
  }
};

/**
 * Get a single transaction by ID
 */
export const getTransactionById = async (req: Request, res: Response) => {
  try {
    if (!req.profile) {
      return res.status(401).json({ success: false, message: 'Profile not authenticated' });
    }

    const profile = req.profile as unknown as IProfile;
    const { transactionId } = req.params;

    if (!transactionId) {
      return res.status(400).json({ success: false, message: 'Transaction ID is required' });
    }

    // Find the transaction
    const transaction = await MyPtsTransactionModel.findOne({
      _id: transactionId,
      profileId: (profile._id as unknown as mongoose.Types.ObjectId).toString()
    });

    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    return res.status(200).json({
      success: true,
      data: transaction
    });
  } catch (error: any) {
    logger.error(`Error getting transaction by ID: ${error.message}`, { error });
    return res.status(500).json({ success: false, message: 'Failed to get transaction' });
  }
};

/**
 * Get transaction by reference ID (e.g., payment intent ID)
 */
export const getTransactionByReference = async (req: Request, res: Response) => {
  try {
    if (!req.profile) {
      return res.status(401).json({ success: false, message: 'Profile not authenticated' });
    }

    const profile = req.profile as unknown as IProfile;
    const { referenceId } = req.params;

    if (!referenceId) {
      return res.status(400).json({ success: false, message: 'Reference ID is required' });
    }

    // Find transaction by reference ID in metadata
    const transaction = await MyPtsTransactionModel.findOne({
      profileId: (profile._id as unknown as mongoose.Types.ObjectId).toString(),
      $or: [
        { 'metadata.paymentIntentId': referenceId },
        { 'metadata.stripePaymentIntentId': referenceId },
        { 'metadata.checkoutSessionId': referenceId },
        { 'metadata.payoutId': referenceId },
        { 'metadata.transferId': referenceId },
        { 'metadata.reference': referenceId },
        { referenceId: referenceId }
      ]
    });

    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    return res.status(200).json({
      success: true,
      data: transaction
    });
  } catch (error: any) {
    logger.error(`Error getting transaction by reference: ${error.message}`, { error });
    return res.status(500).json({ success: false, message: 'Failed to get transaction by reference' });
  }
};

/**
 * Buy MyPts with real money using Stripe
 */
import { stripeService } from '../services/stripe.service';
import { stripeConfig } from '../config/stripe.config';

export const buyMyPts = async (req: Request, res: Response) => {
  try {
    if (!req.profile) {
      return res.status(401).json({ success: false, message: 'Profile not authenticated' });
    }

    const profile = req.profile as unknown as IProfile;
    const { amount, paymentMethod, paymentMethodId } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    // Get the value of MyPts in the default currency
    const valueInfo = await profile.getMyPtsValue(stripeConfig.currency.toUpperCase());

    // Calculate the amount in cents for Stripe
    const amountInCents = stripeService.convertMyPtsToCents(amount, valueInfo.valuePerPts);

    // Create a payment intent with Stripe
    logger.info('Creating Stripe payment intent', {
      profileId: (profile._id as unknown as mongoose.Types.ObjectId).toString(),
      amount,
      amountInCents,
      currency: stripeConfig.currency
    });

    const paymentIntent = await stripeService.createPaymentIntent(
      amountInCents,
      stripeConfig.currency,
      {
        profileId: (profile._id as unknown as mongoose.Types.ObjectId).toString(),
        myPtsAmount: amount.toString(),
        description: `Purchase of ${amount} MyPts`
      }
    );

    logger.info('Stripe payment intent created successfully', {
      paymentIntentId: paymentIntent.id,
      amount,
      amountInCents
    });

    // Get the hub and check holding supply
    const hub = await myPtsHubService.getHubState();
    logger.info('Current hub holding supply', { holdingSupply: hub.holdingSupply, amount });

    // We'll handle the actual movement of MyPts when the payment is confirmed in the webhook
    // This is just a check to log the current state
    if (hub.holdingSupply < amount) {
      logger.warn('Holding supply may be insufficient for purchase', {
        holdingSupply: hub.holdingSupply,
        requestedAmount: amount,
        deficit: amount - hub.holdingSupply
      });
    }

    const myPts = await profile.getMyPts();

    // Create a pending transaction record
    const transaction = await MyPtsTransactionModel.create({
      profileId: (profile._id as unknown as mongoose.Types.ObjectId).toString(),
      type: TransactionType.BUY_MYPTS,
      amount,
      balance: myPts.balance + amount, // Expected balance after completion
      description: `Buying ${amount} MyPts`,
      status: TransactionStatus.PENDING,
      metadata: {
        paymentMethod,
        paymentIntentId: paymentIntent.id,
        amountInCents,
        currency: stripeConfig.currency
      },
      referenceId: paymentIntent.id
    });

    // If the payment method ID is provided, confirm the payment intent
    if (paymentMethodId) {
      logger.info('Confirming payment intent with provided payment method', {
        paymentIntentId: paymentIntent.id,
        paymentMethodId: paymentMethodId.substring(0, 10) + '...' // Log only part of the ID for security
      });

      try {
        const confirmedIntent = await stripeService.confirmPaymentIntent(
          paymentIntent.id,
          paymentMethodId
        );

        // If payment requires additional action, return the client secret
        if (confirmedIntent.status === 'requires_action') {
          logger.info('Payment requires additional action', {
            paymentIntentId: paymentIntent.id,
            status: confirmedIntent.status,
            transactionId: transaction._id
          });

          return res.status(200).json({
            success: true,
            requiresAction: true,
            clientSecret: paymentIntent.client_secret,
            transactionId: transaction._id
          });
        }

        // If payment succeeded immediately, process the payment success
        if (confirmedIntent.status === 'succeeded') {
          logger.info('Payment succeeded immediately', {
            paymentIntentId: paymentIntent.id,
            status: confirmedIntent.status,
            transactionId: transaction._id
          });

          // Process the successful payment
          // Update transaction status to completed
          transaction.status = TransactionStatus.COMPLETED;
          await transaction.save();

          // Update MyPts balance
          myPts.balance += amount;
          myPts.lifetimeEarned += amount;
          myPts.lastTransaction = new Date();
          await myPts.save();

          // Also update the profile document
          await ProfileModel.findByIdAndUpdate(profile._id, {
            myPtsBalance: myPts.balance,
            'ProfileMypts.currentBalance': myPts.balance,
            'ProfileMypts.lifetimeMypts': myPts.lifetimeEarned
          });

          // Notify the user of the completed transaction
          try {
            console.log('[DIRECT_PURCHASE] About to call notifyUserOfCompletedTransaction for transaction:', transaction._id.toString());
            logger.info(`[DIRECT_PURCHASE] Notifying user of completed transaction: ${transaction._id}`);
            await notifyUserOfCompletedTransaction(transaction);
            console.log('[DIRECT_PURCHASE] Successfully called notifyUserOfCompletedTransaction for transaction:', transaction._id.toString());
            logger.info(`[DIRECT_PURCHASE] User notified of completed transaction: ${transaction._id}`);
          } catch (notifyError) {
            console.log('[DIRECT_PURCHASE] Error calling notifyUserOfCompletedTransaction:', notifyError);
            logger.error(`[DIRECT_PURCHASE] Error notifying user of completed transaction: ${transaction._id}`, notifyError);
            // Continue even if notification fails
          }

          return res.status(200).json({
            success: true,
            requiresAction: false,
            clientSecret: paymentIntent.client_secret,
            transactionId: transaction._id,
            paymentIntentId: paymentIntent.id
          });
        }

        logger.info('Payment intent confirmation returned unexpected status', {
          paymentIntentId: paymentIntent.id,
          status: confirmedIntent.status
        });
      } catch (error) {
        logger.error('Error confirming payment intent', { error, paymentIntentId: paymentIntent.id });
        // Update transaction status to failed
        transaction.status = TransactionStatus.FAILED;
        await transaction.save();

        return res.status(400).json({
          success: false,
          message: 'Payment confirmation failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Return the payment intent details to the client
    return res.status(200).json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: amountInCents,
        currency: stripeConfig.currency,
        transactionId: transaction._id
      }
    });
  } catch (error: any) {
    logger.error(`Error buying MyPts: ${error.message}`, { error });
    return res.status(500).json({ success: false, message: 'Failed to buy MyPts' });
  }
};

/**
 * Sell MyPts for real money using Stripe
 */
export const sellMyPts = async (req: Request, res: Response) => {
  try {
    if (!req.profile) {
      return res.status(401).json({ success: false, message: 'Profile not authenticated' });
    }

    const profile = req.profile as any;
    const { amount, paymentMethod, accountDetails } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    if (!paymentMethod) {
      return res.status(400).json({ success: false, message: 'Payment method is required' });
    }

    if (!accountDetails) {
      return res.status(400).json({ success: false, message: 'Account details are required' });
    }

    // Validate account details based on payment method
    if (paymentMethod === 'bank_transfer') {
      if (!accountDetails.accountName || !accountDetails.accountNumber) {
        return res.status(400).json({
          success: false,
          message: 'Bank account details are incomplete',
          errors: [
            !accountDetails.accountName ? { path: 'accountDetails.accountName', message: 'Account name is required' } : null,
            !accountDetails.accountNumber ? { path: 'accountDetails.accountNumber', message: 'Account number is required' } : null
          ].filter(Boolean)
        });
      }
    } else if (paymentMethod === 'paypal') {
      if (!accountDetails.email) {
        return res.status(400).json({
          success: false,
          message: 'PayPal email is required',
          errors: [{ path: 'accountDetails.email', message: 'PayPal email is required' }]
        });
      }
    } else if (paymentMethod === 'crypto') {
      if (!accountDetails.walletAddress || !accountDetails.cryptoType) {
        return res.status(400).json({
          success: false,
          message: 'Cryptocurrency details are incomplete',
          errors: [
            !accountDetails.walletAddress ? { path: 'accountDetails.walletAddress', message: 'Wallet address is required' } : null,
            !accountDetails.cryptoType ? { path: 'accountDetails.cryptoType', message: 'Cryptocurrency type is required' } : null
          ].filter(Boolean)
        });
      }
    }

    // Get MyPts directly from the model
    const myPts = await MyPtsModel.findOne({ profileId: profile._id }) ||
      await MyPtsModel.create({
        profileId: profile._id,
        balance: profile.ProfileMypts?.currentBalance || 0,
        lifetimeEarned: profile.ProfileMypts?.lifetimeMypts || 0,
        lifetimeSpent: 0,
        lastTransaction: new Date()
      });

    if (myPts.balance < amount) {
      return res.status(400).json({ success: false, message: 'Insufficient MyPts balance' });
    }

    // Create value information object for the default currency
    const valueInfo = {
      valuePerPts: 0.024, // Default base value
      currency: stripeConfig.currency.toUpperCase(),
      symbol: stripeConfig.currency.toUpperCase() === 'USD' ? '$' : stripeConfig.currency.toUpperCase() === 'EUR' ? '€' : stripeConfig.currency.toUpperCase(),
      totalValue: myPts.balance * 0.024,
      formattedValue: `${stripeConfig.currency.toUpperCase() === 'USD' ? '$' : stripeConfig.currency.toUpperCase() === 'EUR' ? '€' : stripeConfig.currency.toUpperCase()}${(myPts.balance * 0.024).toFixed(2)}`
    };

    // Calculate the amount in cents for Stripe
    const amountInCents = stripeService.convertMyPtsToCents(amount, valueInfo.valuePerPts);

    // For selling MyPts, we'll create a transaction first and then process the payout
    // In a production environment, you would integrate with Stripe Connect for payouts
    // For now, we'll create a transaction and mark it as pending for admin approval

    // Start a session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    let transactionRecord;

    try {
      // Instead of deducting MyPts immediately, we'll create a transaction with RESERVED status
      // The MyPts will only be deducted when the admin approves the transaction

      // Create transaction record with RESERVED status
      const transaction = await MyPtsTransactionModel.create([
        {
          profileId: (profile._id as unknown as mongoose.Types.ObjectId).toString(),
          type: TransactionType.SELL_MYPTS,
          amount: -amount, // Negative amount for deductions (will be applied when approved)
          balance: myPts.balance, // Current balance (not yet deducted)
          description: `Requested to sell ${amount} MyPts`,
          status: TransactionStatus.RESERVED, // Mark as reserved for admin approval
          metadata: {
            paymentMethod,
            accountDetails,
            amountInCents,
            currency: stripeConfig.currency,
            valuePerMyPt: valueInfo.valuePerPts,
            requestedAmount: amount, // Store the requested amount for later use
            originalBalance: myPts.balance // Store the original balance
          }
        }
      ], { session });

      // We don't move MyPts to reserve yet - we'll do that when the admin approves
      // Instead, we'll just record the transaction and notify the admin

      // Update the transaction with additional metadata
      await MyPtsTransactionModel.findByIdAndUpdate(
        transaction[0]._id,
        {
          'metadata.requestedAt': new Date(),
          'metadata.expectedBalance': myPts.balance - amount // Calculate expected balance after approval
        },
        { session }
      );

      await session.commitTransaction();

      // Commit and respond immediately
      transactionRecord = transaction[0];

      // Immediate response
      res.status(200).json({
        success: true,
        data: {
          transaction: transactionRecord,
          balance: myPts.balance, // Current balance (unchanged)
          status: TransactionStatus.RESERVED,
          message: 'Your sell request has been submitted and is pending admin approval. Your MyPts will remain in your account until approved. You will be notified once processed.'
        }
      });

      // Fire-and-forget notifications
      (async () => {
        try {
          await notifyAdminsOfTransaction(transactionRecord);
        } catch (err) {
          logger.error('Error notifying admins of sell request:', err);
        }
        try {
          const notifService = new NotificationService();

          await notifService.createNotification({
            recipient: profile.owner,
            type: 'sell_submitted',
            title: 'MyPts Sale Request Submitted',
            message: `Your request to sell ${amount} MyPts is pending admin approval.`,
            relatedTo: {
              model: 'Transaction',
              id: transactionRecord._id
            },
            priority: 'low',
          });
        } catch (err) {
          logger.error('Error sending sell_submitted notification:', err);
        }
      })();
      return;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }

  } catch (error: any) {
    logger.error(`Error selling MyPts: ${error.message}`, { error });
    return res.status(500).json({ success: false, message: 'Failed to sell MyPts' });
  }
};

/**
 * Purchase a product for another profile using MyPts
 */
export const purchaseProduct = async (req: Request, res: Response) => {
  try {
    if (!req.profile) {
      return res.status(401).json({ success: false, message: 'Profile not authenticated' });
    }

    const profile = req.profile as unknown as IProfile;
    const { amount, toProfileId, productId, productName } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    if (!toProfileId) {
      return res.status(400).json({ success: false, message: 'Recipient profile ID is required' });
    }

    if (!productId || !productName) {
      return res.status(400).json({ success: false, message: 'Product information is required' });
    }

    // Validate recipient profile exists
    const recipientProfile = await ProfileModel.findById(toProfileId);
    if (!recipientProfile) {
      return res.status(404).json({ success: false, message: 'Recipient profile not found' });
    }

    // Check if sender and recipient are the same
    const profileId = (profile._id as unknown as mongoose.Types.ObjectId).toString();
    if (profileId === toProfileId.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot purchase a product for yourself' });
    }

    const myPts = await profile.getMyPts();

    if (myPts.balance < amount) {
      return res.status(400).json({ success: false, message: 'Insufficient MyPts balance' });
    }

    // Start a session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Deduct points from sender
      myPts.balance -= amount;
      myPts.lifetimeSpent += amount;
      myPts.lastTransaction = new Date();
      await myPts.save({ session });

      // Create sender transaction record
      const senderTransaction = await MyPtsTransactionModel.create([{
        profileId: (profile._id as unknown as mongoose.Types.ObjectId).toString(),
        type: TransactionType.PURCHASE_PRODUCT,
        amount: -amount,
        balance: myPts.balance,
        description: `Purchased product: ${productName} for profile: ${toProfileId} using ${amount} MyPts`,
        metadata: { productId, productName, recipientProfileId: toProfileId }
      }], { session });

      // Add points to receiver
      let receiverPoints = await MyPtsModel.findOne({ profileId: toProfileId });

      if (!receiverPoints) {
        // Create new MyPts document for receiver if it doesn't exist
        const newReceiverPoints = await MyPtsModel.create([{
          profileId: toProfileId,
          balance: amount,
          lifetimeEarned: amount,
          lastTransaction: new Date()
        }], { session });
        receiverPoints = newReceiverPoints[0]; // Extract from array when using create with session
      } else {
        // Update existing receiver points
        receiverPoints.balance += amount;
        receiverPoints.lifetimeEarned += amount;
        receiverPoints.lastTransaction = new Date();
        await receiverPoints.save({ session });
      }

      // Create receiver transaction record
      const receiverTransaction = await MyPtsTransactionModel.create([{
        profileId: toProfileId,
        type: TransactionType.RECEIVE_PRODUCT_PAYMENT,
        amount: amount,
        balance: receiverPoints?.balance || amount,
        description: `Received ${amount} MyPts payment for product: ${productName} from profile: ${(profile._id as unknown as mongoose.Types.ObjectId).toString()}`,
        metadata: { productId, productName, buyerProfileId: (profile._id as unknown as mongoose.Types.ObjectId).toString() },
        relatedTransaction: senderTransaction[0]._id // First item from array when using create with session
      }], { session });

      // Update sender transaction with related transaction
      await MyPtsTransactionModel.findByIdAndUpdate(
        senderTransaction[0]._id,
        { relatedTransaction: receiverTransaction[0]._id },
        { session }
      );

      // Update the profile's myPtsBalance and ProfileMypts fields
      await ProfileModel.findByIdAndUpdate(profile._id, {
        myPtsBalance: myPts.balance,
        'ProfileMypts.currentBalance': myPts.balance,
        'ProfileMypts.lifetimeMypts': myPts.lifetimeEarned
      }, { session });

      // Update recipient's myPtsBalance and ProfileMypts fields
      await ProfileModel.findByIdAndUpdate(toProfileId, {
        myPtsBalance: receiverPoints?.balance || amount,
        'ProfileMypts.currentBalance': receiverPoints?.balance || amount,
        'ProfileMypts.lifetimeMypts': receiverPoints?.lifetimeEarned || amount
      }, { session });

      await session.commitTransaction();

      // Send notifications to admin for both transactions
      await notifyAdminsOfTransaction(senderTransaction[0]);
      await notifyAdminsOfTransaction(receiverTransaction[0]);

      return res.status(200).json({
        success: true,
        data: {
          transaction: senderTransaction[0],
          newBalance: myPts.balance
        }
      });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error: any) {
    logger.error(`Error purchasing product: ${error.message}`, { error });
    return res.status(500).json({ success: false, message: 'Failed to purchase product' });
  }
};

/**
 * Get all profile transactions (admin only)
 */
export const getAllProfileTransactions = async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    const user = req.user as any
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const {
      limit = 20,
      offset = 0,
      sort = 'desc',
      profileId,
      type,
      status,
      startDate,
      endDate
    } = req.query;

    // Build query
    const query: any = {};

    if (profileId) {
      query.profileId = profileId;
    }

    if (type) {
      query.type = type;
    }

    if (status) {
      query.status = status;
    }

    if (startDate || endDate) {
      query.createdAt = {};

      if (startDate) {
        query.createdAt.$gte = new Date(startDate as string);
      }

      if (endDate) {
        query.createdAt.$lte = new Date(endDate as string);
      }
    }

    // Log the query for debugging
    logger.info('getAllProfileTransactions query:', { query });

    // Get transactions
    const [transactions, total] = await Promise.all([
      MyPtsTransactionModel.find(query)
        .sort({ createdAt: sort === 'asc' ? 1 : -1 })
        .skip(Number(offset))
        .limit(Number(limit)),
      MyPtsTransactionModel.countDocuments(query)
    ]);

    return res.status(200).json({
      success: true,
      data: {
        transactions,
        pagination: {
          total,
          limit: Number(limit),
          offset: Number(offset),
          hasMore: Number(offset) + transactions.length < total
        }
      }
    });
  } catch (error: any) {
    logger.error(`Error getting all profile transactions: ${error.message}`, { error });
    return res.status(500).json({ success: false, message: 'Failed to get all profile transactions' });
  }
};

/**
 * Reject a sell transaction (admin only)
 */
export const rejectSellTransaction = async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    const user = req.user as any;
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const { transactionId, reason } = req.body;

    if (!transactionId) {
      return res.status(400).json({ success: false, message: 'Transaction ID is required' });
    }

    // Find the transaction
    const transaction = await MyPtsTransactionModel.findById(transactionId);
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    // Verify it's a sell transaction and is in RESERVED status
    if (transaction.type !== TransactionType.SELL_MYPTS) {
      return res.status(400).json({ success: false, message: 'Not a sell transaction' });
    }

    if (transaction.status !== TransactionStatus.RESERVED) {
      return res.status(400).json({
        success: false,
        message: `Transaction cannot be rejected because it is ${transaction.status}`
      });
    }

    // Get the profile
    const profile = await ProfileModel.findById(transaction.profileId);
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    // Update transaction status to REJECTED
    transaction.status = TransactionStatus.REJECTED;
    transaction.metadata = {
      ...transaction.metadata,
      rejectedBy: user._id,
      rejectedAt: new Date(),
      rejectionReason: reason || 'Rejected by admin'
    };

    await transaction.save();

    // Notify the user of the rejection
    try {
      // Create a notification for the user
      const notificationService = new NotificationService();

      await notificationService.createNotification({
        recipient: profile.profileInformation?.creator,
        type: 'system_notification',
        title: 'MyPts Sale Declined',
        message: `We regret to inform you that your sale request for ${transaction.metadata?.requestedAmount || Math.abs(transaction.amount)} MyPts has been declined.${reason ? ` Reason: ${reason}.` : ''} Please visit your dashboard for more details or contact our support team if you need assistance.`,
        relatedTo: {
          model: 'Transaction',
          id: transaction._id
        },
        action: {
          text: 'View Details',
          url: `/dashboard/transactions/${transaction._id}`
        },
        priority: 'high',
        metadata: {
          transactionId: transaction._id.toString(),
          transactionType: transaction.type,
          rejectionReason: reason || 'Rejected by admin'
        }
      });

      // Send email notification if possible
      try {
        const user = await mongoose.model('User').findById(profile.profileInformation?.creator);
        if (user && user.email) {
          const emailSubject = 'MyPts Sale Request Declined';

          // Create email content
          const emailContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">MyPts Sale Request Declined</h2>
              <p>We regret to inform you that your sale request for ${transaction.metadata?.requestedAmount || Math.abs(transaction.amount)} MyPts has been declined.${reason ? ` Reason: ${reason}.` : ''} Please review the details in your dashboard or contact our support team for assistance.</p>
              <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p><strong>Reason for Decline:</strong> ${reason || 'Rejected by admin'}</p>
                <p><strong>Transaction ID:</strong> ${transaction._id}</p>
                <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
              </div>
              <p>Thank you for choosing MyPts. We’re here to help if you need any support.</p>
            </div>
          `;

          // Send the email
          await EmailService.sendAdminNotification(user.email, emailSubject, emailContent);
        }
      } catch (emailError) {
        logger.error(`Error sending transaction rejection email: ${emailError}`);
        // Continue even if email fails
      }

    } catch (notifyError) {
      logger.error('Error notifying user of rejected transaction', {
        error: notifyError,
        transactionId: transaction._id
      });
      // Continue even if notification fails
    }

    return res.status(200).json({
      success: true,
      message: 'Transaction rejected successfully',
      data: {
        transaction
      }
    });
  } catch (error: any) {
    logger.error(`Error rejecting sell transaction: ${error.message}`, { error });
    return res.status(500).json({ success: false, message: 'Failed to reject transaction' });
  }
};

/**
 * Process a sell transaction with Stripe (admin only)
 */
export const processSellTransaction = async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    const user = req.user as any;
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const { transactionId, paymentReference, notes } = req.body;

    if (!transactionId) {
      return res.status(400).json({ success: false, message: 'Transaction ID is required' });
    }

    // Find the transaction
    const transaction = await MyPtsTransactionModel.findById(transactionId);
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    // Verify it's a sell transaction and is in RESERVED status
    if (transaction.type !== TransactionType.SELL_MYPTS) {
      return res.status(400).json({ success: false, message: 'Not a sell transaction' });
    }

    if (transaction.status !== TransactionStatus.RESERVED) {
      return res.status(400).json({
        success: false,
        message: `Transaction cannot be processed because it is ${transaction.status}`
      });
    }

    // Get the profile
    const profile = await ProfileModel.findById(transaction.profileId);
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    // Get payment details from transaction metadata
    const {
      paymentMethod,
      accountDetails,
      amountInCents,
      currency = stripeConfig.currency
    } = transaction.metadata || {};

    if (!paymentMethod || !accountDetails || !amountInCents) {
      return res.status(400).json({ success: false, message: 'Transaction missing payment details' });
    }

    // Process payment based on payment method
    let paymentResult;

    try {
      logger.info('Processing sell transaction payment', {
        transactionId: transaction._id,
        paymentMethod,
        amountInCents
      });

      if (paymentMethod === 'bank_transfer') {
        try {
          // For bank transfers, use the enhanced direct bank payout method
          logger.info('Processing bank transfer using Stripe Payouts API', {
            transactionId: transaction._id.toString(),
            bankName: accountDetails.bankName,
            country: accountDetails.country || 'US'
          });

          // Convert account details to the format expected by createDirectBankPayout
          const bankDetails = {
            accountName: accountDetails.accountName,
            accountNumber: accountDetails.accountNumber,
            routingNumber: accountDetails.routingNumber || '',
            bankName: accountDetails.bankName,
            country: accountDetails.country || 'US',
            accountType: accountDetails.accountType || 'checking',
            swiftCode: accountDetails.swiftCode
          };

          // Create metadata for the payout
          const bankPayoutMetadata = {
            transactionId: transaction._id.toString(),
            profileId: transaction.profileId,
            description: `Payout for selling ${Math.abs(transaction.amount)} MyPts`,
            paymentReference: paymentReference || `BANK-${Date.now()}`
          };

          // Attempt to create a direct bank payout
          const bankPayoutResult = await stripeService.createDirectBankPayout(
            amountInCents,
            currency,
            bankDetails,
            bankPayoutMetadata
          );

          if (bankPayoutResult.success) {
            // Successful automated payout
            paymentResult = {
              type: 'bank_transfer',
              method: 'stripe_payout',
              reference: paymentReference || bankPayoutResult.payoutId || `BANK-${Date.now()}`,
              payoutId: bankPayoutResult.payoutId,
              status: 'completed',
              details: bankPayoutResult.details
            };

            logger.info('Bank transfer processed successfully via Stripe Payouts API', {
              transactionId: transaction._id.toString(),
              payoutId: bankPayoutResult.payoutId
            });
          } else {
            // Automated payout failed, fall back to manual processing
            logger.warn('Automated bank transfer failed, falling back to manual processing', {
              transactionId: transaction._id.toString(),
              error: bankPayoutResult.message
            });

            paymentResult = {
              type: 'bank_transfer',
              method: 'manual',
              reference: paymentReference || `MANUAL-BANK-${Date.now()}`,
              status: 'completed',
              automatedAttemptFailed: true,
              failureReason: bankPayoutResult.message
            };
          }
        } catch (error) {
          // If there's any error, fall back to manual processing
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          logger.error('Error processing bank transfer, falling back to manual processing', {
            error: errorMessage,
            transactionId: transaction._id.toString()
          });

          paymentResult = {
            type: 'bank_transfer',
            method: 'manual',
            reference: paymentReference || `MANUAL-BANK-${Date.now()}`,
            status: 'completed',
            automatedAttemptFailed: true,
            failureReason: errorMessage
          };
        }
      }
      else if (paymentMethod === 'paypal') {
        // For PayPal, we'll record the payment reference
        paymentResult = {
          type: 'paypal',
          reference: paymentReference || `PAYPAL-${Date.now()}`,
          status: 'completed'
        };
      }
      else if (paymentMethod === 'stripe') {
        try {
          // For Stripe, we'll create a payout
          // In test mode, this will create a test payout that won't actually move money
          logger.info('Creating Stripe payout for transaction', {
            transactionId: transaction._id.toString(),
            amount: amountInCents,
            currency
          });

          // Check if we're in test mode
          const isTestMode = stripeConfig.secretKey.startsWith('sk_test_');
          logger.info(`Stripe mode: ${isTestMode ? 'TEST' : 'LIVE'} for transaction ${transaction._id}`);

          // In a production environment, you would need to:
          // 1. Have a Stripe Connect account set up for the user
          // 2. Have funds in your Stripe account to make the payout
          // 3. Use the destination parameter to specify where to send the funds

          // If we're in live mode, check the Stripe balance first
          if (!isTestMode) {
            try {
              // Get the available balance
              const balance = await stripeService.getBalance();
              const availableBalance = balance.available.find(b => b.currency === currency);
              const availableAmount = availableBalance ? availableBalance.amount : 0;

              logger.info('Stripe available balance for payout', {
                availableAmount,
                currency,
                requestedAmount: amountInCents,
                transactionId: transaction._id.toString()
              });

              if (availableAmount < amountInCents) {
                throw new Error(`Insufficient Stripe balance for payout. Available: ${availableAmount/100} ${currency.toUpperCase()}, Requested: ${amountInCents/100} ${currency.toUpperCase()}`);
              }
            } catch (balanceError) {
              logger.error('Error checking Stripe balance', {
                error: balanceError instanceof Error ? balanceError.message : 'Unknown error',
                transactionId: transaction._id.toString()
              });

              // Continue with the payout attempt, it will fail if there's not enough balance
            }
          }

          // Determine if we should use a destination
          let destination = undefined;
          if (accountDetails.stripeAccountId) {
            destination = accountDetails.stripeAccountId;
            logger.info('Using Stripe Connect account for payout', {
              destinationPrefix: destination.substring(0, 8) + '...',
              transactionId: transaction._id.toString()
            });
          } else if (accountDetails.cardNumber) {
            logger.info('Using card details for payout', {
              cardNumberPrefix: accountDetails.cardNumber.substring(0, 4) + '...',
              transactionId: transaction._id.toString()
            });

            // In a real implementation, you would create a card token and use it as the destination
            // For now, we'll just log that we would do this
            logger.info('Card payouts require creating a card token first', {
              transactionId: transaction._id.toString()
            });
          }

          // Ensure all metadata values are strings
          const metadata = {
            transactionId: transaction._id.toString(),
            profileId: typeof transaction.profileId === 'string' ? transaction.profileId : transaction.profileId.toString(),
            description: `Payout for selling ${Math.abs(transaction.amount)} MyPts`,
            amount: Math.abs(transaction.amount).toString(),
            currency: currency.toUpperCase()
          };

          // Log the metadata for debugging
          logger.info('Creating Stripe payout with metadata', {
            metadata,
            transactionId: transaction._id.toString()
          });

          const payout = await stripeService.createPayout(
            amountInCents,
            currency,
            'standard',
            destination,
            metadata
          );

          logger.info('Stripe payout created successfully', {
            payoutId: payout.id,
            status: payout.status,
            amount: payout.amount,
            currency: payout.currency,
            arrivalDate: payout.arrival_date ? new Date(payout.arrival_date * 1000).toISOString() : 'unknown',
            transactionId: transaction._id.toString()
          });

          paymentResult = {
            type: 'stripe',
            payoutId: payout.id,
            status: payout.status,
            amount: amountInCents,
            currency: currency,
            estimatedArrival: payout.arrival_date ? new Date(payout.arrival_date * 1000).toISOString() : undefined,
            testMode: isTestMode
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';

          // Check for specific Stripe errors and provide more helpful messages
          let userFriendlyMessage = errorMessage;
          let adminNotes = '';

          if (errorMessage.includes("don't have any external accounts")) {
            userFriendlyMessage = "Payment will be processed manually. No Stripe external account is set up for payouts.";
            adminNotes = "ADMIN NOTE: You need to set up an external account in Stripe to process automatic payouts. " +
                        "Go to your Stripe Dashboard > Settings > Connect settings > External accounts to add a bank account.";

            logger.warn('Stripe payout failed due to missing external account', {
              transactionId: transaction._id.toString(),
              solution: 'Set up an external account in Stripe Dashboard'
            });
          } else if (errorMessage.includes("Insufficient funds")) {
            userFriendlyMessage = "Payment will be processed manually. Insufficient funds in Stripe account.";
            adminNotes = "ADMIN NOTE: Your Stripe account doesn't have sufficient funds to process this payout automatically. " +
                        "Add funds to your Stripe account or process this payment manually.";

            logger.warn('Stripe payout failed due to insufficient funds', {
              transactionId: transaction._id.toString(),
              solution: 'Add funds to Stripe account'
            });
          }

          logger.error('Error creating Stripe payout', {
            error: errorMessage,
            transactionId: transaction._id.toString(),
            userFriendlyMessage,
            adminNotes
          });

          // Still mark as completed but note the error
          paymentResult = {
            type: 'stripe',
            status: 'manual_required',
            error: errorMessage,
            userFriendlyMessage,
            adminNotes,
            manualReference: paymentReference || `MANUAL-STRIPE-${Date.now()}`
          };
        }
      }
      else if (paymentMethod === 'crypto') {
        // For crypto, we'll record the transaction hash
        paymentResult = {
          type: 'crypto',
          reference: paymentReference || `CRYPTO-${Date.now()}`,
          cryptoType: accountDetails.cryptoType,
          status: 'completed'
        };
      }
      else {
        // Default case - manual processing
        paymentResult = {
          type: 'manual',
          reference: paymentReference || `MANUAL-${Date.now()}`,
          status: 'completed'
        };
      }

      logger.info('Payment processed successfully', {
        transactionId: transaction._id,
        paymentResult
      });
    } catch (error) {
      logger.error('Error processing payment', { error, transactionId: transaction._id });
      return res.status(500).json({
        success: false,
        message: 'Failed to process payment',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Start a session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Get the MyPts document for the profile
      const myPts = await MyPtsModel.findOne({ profileId: profile._id }) ||
        await MyPtsModel.create({
          profileId: profile._id,
          balance: profile.ProfileMypts?.currentBalance || 0,
          lifetimeEarned: profile.ProfileMypts?.lifetimeMypts || 0,
          lifetimeSpent: 0,
          lastTransaction: new Date()
        });

      // Get the requested amount from metadata
      const requestedAmount = transaction.metadata?.requestedAmount || Math.abs(transaction.amount);

      // Check if the user still has enough MyPts
      if (myPts.balance < requestedAmount) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Insufficient MyPts balance. The user no longer has enough MyPts to complete this transaction.'
        });
      }

      // Now deduct the MyPts from the user's balance
      myPts.balance -= requestedAmount;
      myPts.lifetimeSpent += requestedAmount;
      myPts.lastTransaction = new Date();
      await myPts.save({ session });

      // Move MyPts from circulation to reserve
      const hubResult = await myPtsHubService.moveToReserve(
        requestedAmount,
        `Sale by profile ${profile._id} (approved by admin)`,
        user._id,
        {
          profileId: profile._id,
          paymentMethod,
          accountDetails,
          amountInCents,
          currency
        },
        transaction._id
      );

      // Update the profile's myPtsBalance and ProfileMypts fields
      await ProfileModel.findByIdAndUpdate(profile._id, {
        myPtsBalance: myPts.balance,
        'ProfileMypts.currentBalance': myPts.balance,
        'ProfileMypts.lifetimeMypts': myPts.lifetimeEarned
      }, { session });

      // Update transaction status and add payment details
      transaction.status = TransactionStatus.COMPLETED;
      transaction.balance = myPts.balance; // Update with the new balance
      transaction.metadata = {
        ...transaction.metadata,
        paymentResult,
        approvedBy: user._id,
        approvedAt: new Date(),
        adminNotes: notes,
        hubLogId: hubResult.logId
      };

      await transaction.save({ session });

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      logger.error('Error processing sell transaction', { error, transactionId: transaction._id });
      return res.status(500).json({
        success: false,
        message: 'Failed to process transaction',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      session.endSession();
    }

    // Notify the user
    try {
      await notifyUserOfCompletedTransaction(transaction);
    } catch (notifyError) {
      logger.error('Error notifying user of completed transaction', {
        error: notifyError,
        transactionId: transaction._id
      });
      // Continue even if notification fails
    }

    return res.status(200).json({
      success: true,
      message: 'Transaction processed successfully',
      data: {
        transaction,
        paymentResult
      }
    });
  } catch (error: any) {
    logger.error(`Error processing sell transaction: ${error.message}`, { error });
    return res.status(500).json({ success: false, message: 'Failed to process transaction' });
  }
};

/**
 * Award MyPts to a profile (admin only)
 */
export const awardMyPts = async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    const user = req.user as any
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const { profileId, amount, reason } = req.body;

    if (!profileId || !mongoose.Types.ObjectId.isValid(profileId)) {
      return res.status(400).json({ success: false, message: 'Valid profile ID is required' });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    // Validate profile exists
    const profile = await ProfileModel.findById(profileId);
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    // Get the hub and check supply pools
    let hub = await myPtsHubService.getHubState();
    logger.info(`Current hub state before award: reserveSupply=${hub.reserveSupply}, holdingSupply=${hub.holdingSupply}, amount=${amount}`);

    // Create a valid ObjectId for the admin user
    let adminObjectId;
    try {
      if (mongoose.Types.ObjectId.isValid(user._id)) {
        adminObjectId = mongoose.Types.ObjectId.createFromHexString(user._id.toString());
      } else {
        logger.error(`Invalid admin ID format: ${user._id}`);
        adminObjectId = undefined;
      }
    } catch (idError) {
      logger.error(`Error creating ObjectId from admin ID: ${user._id}`, { error: idError });
      adminObjectId = undefined; // Use undefined if we can't create a valid ObjectId
    }

    // First, check if we need to move MyPts from holding to reserve
    if (hub.reserveSupply < amount && hub.holdingSupply > 0) {
      logger.info(`Need to move MyPts from holding to reserve: reserveSupply=${hub.reserveSupply}, holdingSupply=${hub.holdingSupply}, amount=${amount}`);

      try {
        // Calculate how much to move from holding to reserve
        const moveAmount = Math.min(amount - hub.reserveSupply, hub.holdingSupply);

        // Move MyPts from holding to reserve
        const moveResult = await myPtsHubService.moveFromHoldingToReserve(
          moveAmount,
          `Moving MyPts from holding to reserve for admin award to profile ${profileId}`,
          adminObjectId,
          {
            automatic: true,
            profileId: profileId,
            reason
          }
        );

        logger.info(`MyPts move from holding to reserve result:`, moveResult);

        // Refresh hub state to get updated supply numbers
        hub = await myPtsHubService.getHubState();
        logger.info(`Hub state after moving from holding to reserve: reserveSupply=${hub.reserveSupply}, holdingSupply=${hub.holdingSupply}, amount=${amount}`);
      } catch (moveError) {
        const errorMessage = moveError instanceof Error ? moveError.message : String(moveError);
        logger.error(`Error moving MyPts from holding to reserve: ${errorMessage}`, { error: moveError });
        throw new Error(`Failed to move MyPts from holding to reserve: ${errorMessage}`);
      }
    }

    // Then, check if we still need to issue new MyPts (if reserve is still insufficient)
    if (hub.reserveSupply < amount) {
      logger.info(`Need to issue new MyPts: reserveSupply=${hub.reserveSupply}, amount=${amount}, deficit=${amount - hub.reserveSupply}`);

      try {
        // Issue new MyPts to cover the deficit
        const issueAmount = amount - hub.reserveSupply;
        const issueResult = await myPtsHubService.issueMyPts(
          issueAmount,
          `Automatic issuance for admin award to profile ${profileId}`,
          adminObjectId,
          {
            automatic: true,
            profileId: profileId,
            reason
          }
        );

        logger.info(`MyPts issuance result:`, issueResult);

        // After issuing, we need to move from holding to reserve since issueMyPts adds to holding
        hub = await myPtsHubService.getHubState();
        logger.info(`Hub state after issuance: reserveSupply=${hub.reserveSupply}, holdingSupply=${hub.holdingSupply}, amount=${amount}`);

        // Move the newly issued MyPts from holding to reserve
        if (hub.holdingSupply >= issueAmount) {
          const moveResult = await myPtsHubService.moveFromHoldingToReserve(
            issueAmount,
            `Moving newly issued MyPts from holding to reserve for award to profile ${profileId}`,
            adminObjectId,
            {
              automatic: true,
              profileId: profileId,
              reason
            }
          );

          logger.info(`Moving newly issued MyPts from holding to reserve result:`, moveResult);
        } else {
          logger.error(`Not enough MyPts in holding after issuance: holdingSupply=${hub.holdingSupply}, needed=${issueAmount}`);
          throw new Error(`Failed to prepare enough MyPts for award. Holding: ${hub.holdingSupply}, Needed: ${issueAmount}`);
        }

        // Refresh hub state to get updated supply numbers
        hub = await myPtsHubService.getHubState();
        logger.info(`Final hub state before award: reserveSupply=${hub.reserveSupply}, holdingSupply=${hub.holdingSupply}, amount=${amount}`);

        // Double-check that we have enough in reserve now
        if (hub.reserveSupply < amount) {
          logger.error(`Failed to prepare enough MyPts: reserveSupply=${hub.reserveSupply}, amount=${amount}`);
          throw new Error(`Failed to prepare enough MyPts for award. Reserve: ${hub.reserveSupply}, Needed: ${amount}`);
        }
      } catch (issueError) {
        const errorMessage = issueError instanceof Error ? issueError.message : String(issueError);
        logger.error(`Error preparing MyPts: ${errorMessage}`, { error: issueError });
        throw new Error(`Failed to prepare MyPts: ${errorMessage}`);
      }
    }

    // Start a session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    let transactionRecord;

    try {
      // Ensure profileId is a valid ObjectId
      let profileObjectId;
      try {
        // If profileId is already an ObjectId, use it directly
        if (mongoose.Types.ObjectId.isValid(profileId)) {
          profileObjectId = mongoose.Types.ObjectId.createFromHexString(profileId.toString());
        } else {
          throw new Error('Invalid profile ID format');
        }
      } catch (idError) {
        logger.error(`Error creating ObjectId from profileId: ${profileId}`, { error: idError });
        throw new Error(`Invalid profile ID format: ${profileId}`);
      }

      // Get or create MyPts for the profile
      const myPts = await MyPtsModel.findOrCreate(profileObjectId);

      // Update MyPts document
      myPts.balance += amount;
      myPts.lifetimeEarned += amount;
      myPts.lastTransaction = new Date();
      await myPts.save({ session });

      // Create transaction record first
      const transaction = await MyPtsTransactionModel.create([{
        profileId,
        type: TransactionType.ADJUSTMENT,
        amount,
        balance: myPts.balance,
        description: reason || `Admin award: ${amount} MyPts`,
        metadata: { adminId: user._id }
      }], { session });

      transactionRecord = transaction[0];

      // Move MyPts from reserve to circulation and link with transaction
      let adminObjectId;
      try {
        if (mongoose.Types.ObjectId.isValid(user._id)) {
          adminObjectId = mongoose.Types.ObjectId.createFromHexString(user._id.toString());
        } else {
          logger.error(`Invalid admin ID format: ${user._id}`);
          adminObjectId = undefined;
        }
      } catch (idError) {
        logger.error(`Error creating ObjectId from admin ID: ${user._id}`, { error: idError });
        adminObjectId = undefined; // Use undefined if we can't create a valid ObjectId
      }

      const hubResult = await myPtsHubService.moveToCirculation(
        amount,
        `Admin award to profile ${profileId}`,
        adminObjectId,
        {
          profileId: profileObjectId.toString(), // Use the validated profileId
          reason: reason || `Admin award: ${amount} MyPts`
        },
        transaction[0]._id
      );

      // Update transaction with hub log ID if available
      if (hubResult.logId) {
        await MyPtsTransactionModel.findByIdAndUpdate(
          transaction[0]._id,
          { hubLogId: hubResult.logId },
          { session }
        );
      }

      // Update the profile's myPtsBalance and ProfileMypts fields
      await ProfileModel.findByIdAndUpdate(profileId, {
        myPtsBalance: myPts.balance,
        'ProfileMypts.currentBalance': myPts.balance,
        'ProfileMypts.lifetimeMypts': myPts.lifetimeEarned
      }, { session });

      logger.info(`Updated profile MyPts balance: profileId=${profileId}, balance=${myPts.balance}, lifetimeEarned=${myPts.lifetimeEarned}`);

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }

    return res.status(200).json({
      success: true,
      data: {
        transaction: transactionRecord,
        newBalance: transactionRecord.balance
      }
    });
  } catch (error: any) {
    logger.error(`Error awarding MyPts: ${error.message}`, { error });
    return res.status(500).json({ success: false, message: 'Failed to award MyPts' });
  }
};

/**
 * Make a donation to another profile
 */
export const donateMyPts = async (req: Request, res: Response) => {
  try {
    if (!req.profile) {
      return res.status(401).json({ success: false, message: 'Profile not authenticated' });
    }

    const profile = req.profile as unknown as IProfile;
    const { amount, toProfileId, message } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    if (!toProfileId) {
      return res.status(400).json({ success: false, message: 'Recipient profile ID is required' });
    }

    // Validate recipient profile exists
    const recipientProfile = await ProfileModel.findById(toProfileId);
    if (!recipientProfile) {
      return res.status(404).json({ success: false, message: 'Recipient profile not found' });
    }

    // Check if sender and recipient are the same
    const profileId = (profile._id as unknown as mongoose.Types.ObjectId).toString();
    if (profileId === toProfileId.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot donate MyPts to yourself' });
    }

    const myPts = await profile.getMyPts();

    if (myPts.balance < amount) {
      return res.status(400).json({ success: false, message: 'Insufficient MyPts balance' });
    }

    // Start a session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Deduct points from sender
      myPts.balance -= amount;
      myPts.lifetimeSpent += amount;
      myPts.lastTransaction = new Date();
      await myPts.save({ session });

      // Create sender transaction record
      const senderTransaction = await MyPtsTransactionModel.create([{
        profileId: (profile._id as unknown as mongoose.Types.ObjectId).toString(),
        type: TransactionType.DONATION_SENT,
        amount: -amount,
        balance: myPts.balance,
        description: `Donated ${amount} MyPts to profile: ${toProfileId}${message ? ` - ${message}` : ''}`
      }], { session });

      // Add points to receiver
      let receiverPoints = await MyPtsModel.findOne({ profileId: toProfileId });

      if (!receiverPoints) {
        // Create new MyPts document for receiver if it doesn't exist
        const newReceiverPoints = await MyPtsModel.create([{
          profileId: toProfileId,
          balance: amount,
          lifetimeEarned: amount,
          lastTransaction: new Date()
        }], { session });
        receiverPoints = newReceiverPoints[0]; // Extract from array when using create with session
      } else {
        // Update existing receiver points
        receiverPoints.balance += amount;
        receiverPoints.lifetimeEarned += amount;
        receiverPoints.lastTransaction = new Date();
        await receiverPoints.save({ session });
      }

      // Create receiver transaction record
      const receiverTransaction = await MyPtsTransactionModel.create([{
        profileId: toProfileId,
        type: TransactionType.DONATION_RECEIVED,
        amount: amount,
        balance: receiverPoints?.balance || amount,
        description: `Received ${amount} MyPts donation from profile: ${(profile._id as unknown as mongoose.Types.ObjectId).toString()}${message ? ` - ${message}` : ''}`,
        relatedTransaction: senderTransaction[0]._id // First item from array when using create with session
      }], { session });

      // Update sender transaction with related transaction
      await MyPtsTransactionModel.findByIdAndUpdate(
        senderTransaction[0]._id,
        { relatedTransaction: receiverTransaction[0]._id },
        { session }
      );

      // Update the profile's myPtsBalance and ProfileMypts fields
      await ProfileModel.findByIdAndUpdate(profile._id, {
        myPtsBalance: myPts.balance,
        'ProfileMypts.currentBalance': myPts.balance,
        'ProfileMypts.lifetimeMypts': myPts.lifetimeEarned
      }, { session });

      logger.info(`Updated sender profile MyPts balance: profileId=${profile._id}, balance=${myPts.balance}, lifetimeEarned=${myPts.lifetimeEarned}`);

      // Update recipient's myPtsBalance and ProfileMypts fields
      await ProfileModel.findByIdAndUpdate(toProfileId, {
        myPtsBalance: receiverPoints?.balance || amount,
        'ProfileMypts.currentBalance': receiverPoints?.balance || amount,
        'ProfileMypts.lifetimeMypts': receiverPoints?.lifetimeEarned || amount
      }, { session });

      logger.info(`Updated recipient profile MyPts balance: profileId=${toProfileId}, balance=${receiverPoints?.balance || amount}, lifetimeEarned=${receiverPoints?.lifetimeEarned || amount}`);

      await session.commitTransaction();

      return res.status(200).json({
        success: true,
        data: {
          transaction: senderTransaction[0],
          newBalance: myPts.balance
        }
      });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }

  } catch (error: any) {
    logger.error(`Error donating MyPts: ${error.message}`, { error });
    return res.status(500).json({ success: false, message: 'Failed to donate MyPts' });
  }
};

/**
 * Withdraw MyPts back to reserve
 */
export const withdrawMyPts = async (req: Request, res: Response) => {
  try {
    if (!req.profile) {
      return res.status(401).json({ success: false, message: 'Profile not authenticated' });
    }

    const profile = req.profile as unknown as IProfile;
    const { amount, reason } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    const myPts = await profile.getMyPts();

    if (myPts.balance < amount) {
      return res.status(400).json({ success: false, message: 'Insufficient MyPts balance' });
    }

    // Start a session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    let transactionRecord;

    try {
      // Update MyPts document
      myPts.balance -= amount;
      myPts.lifetimeSpent += amount;
      myPts.lastTransaction = new Date();
      await myPts.save({ session });

      // Create transaction record first
      const transaction = await MyPtsTransactionModel.create([{
        profileId: (profile._id as unknown as mongoose.Types.ObjectId).toString(),
        type: TransactionType.WITHDRAW_MYPTS,
        amount: -amount, // Negative amount for deductions
        balance: myPts.balance,
        description: `Withdrew ${amount} MyPts to reserve${reason ? `: ${reason}` : ''}`,
        status: TransactionStatus.COMPLETED,
        metadata: { reason }
      }], { session });

      // Move MyPts from circulation to reserve and link with transaction
      const hubResult = await myPtsHubService.moveToReserve(
        amount,
        `Withdrawal by profile ${profile._id}: ${reason || 'No reason provided'}`,
        undefined,
        {
          profileId: profile._id,
          reason
        },
        transaction[0]._id
      );

      // Update transaction with hub log ID if available
      if (hubResult.logId) {
        await MyPtsTransactionModel.findByIdAndUpdate(
          transaction[0]._id,
          { hubLogId: hubResult.logId },
          { session }
        );
      }

      // Update the profile's myPtsBalance and ProfileMypts fields
      await ProfileModel.findByIdAndUpdate(profile._id, {
        myPtsBalance: myPts.balance,
        'ProfileMypts.currentBalance': myPts.balance,
        'ProfileMypts.lifetimeMypts': myPts.lifetimeEarned
      }, { session });

      logger.info(`Updated profile MyPts balance after withdrawal: profileId=${profile._id}, balance=${myPts.balance}, lifetimeEarned=${myPts.lifetimeEarned}`);

      await session.commitTransaction();

      // Store the transaction for the response
      transactionRecord = transaction[0];
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }

    return res.status(200).json({
      success: true,
      data: {
        transaction: transactionRecord,
        newBalance: myPts.balance
      }
    });
  } catch (error: any) {
    logger.error(`Error withdrawing MyPts: ${error.message}`, { error });
    return res.status(500).json({ success: false, message: 'Failed to withdraw MyPts' });
  }
};

/**
 * Earn MyPts through activities
 */
/**
 * Admin withdrawal of MyPts from a profile
 * This allows admins to withdraw MyPts from a profile for various reasons
 */
export const adminWithdrawMyPts = async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    const user = req.user as any;
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const { profileId, amount, reason } = req.body;

    if (!profileId) {
      return res.status(400).json({ success: false, message: 'Profile ID is required' });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be a positive number' });
    }

    // Find the profile
    const profile = await ProfileModel.findById(profileId);
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    // Get the MyPts document
    const myPts = await MyPtsModel.findOne({ profileId }) ||
      await MyPtsModel.create({
        profileId,
        balance: profile.ProfileMypts?.currentBalance || 0,
        lifetimeEarned: profile.ProfileMypts?.lifetimeMypts || 0,
        lifetimeSpent: 0,
        lastTransaction: new Date()
      });

    // Check if the profile has enough MyPts
    if (myPts.balance < amount) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient MyPts balance',
        data: {
          currentBalance: myPts.balance,
          requestedAmount: amount
        }
      });
    }

    // Start a session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Deduct MyPts from the profile
      myPts.balance -= amount;
      myPts.lifetimeSpent += amount;
      myPts.lastTransaction = new Date();
      await myPts.save({ session });

      // Create transaction record
      const transaction = await MyPtsTransactionModel.create([{
        profileId,
        type: TransactionType.ADMIN_WITHDRAWAL,
        amount: -amount, // Negative amount for withdrawals
        balance: myPts.balance,
        description: reason ? `Admin withdrawal: ${reason}` : 'Admin withdrawal',
        status: TransactionStatus.COMPLETED,
        metadata: {
          adminId: user._id,
          reason,
          adminUsername: user.username || user.email
        }
      }], { session });

      // Move MyPts from circulation to reserve
      const hubResult = await myPtsHubService.moveToReserve(
        amount,
        `Admin withdrawal from profile ${profileId}: ${reason || 'No reason provided'}`,
        user._id,
        {
          profileId,
          reason,
          adminId: user._id
        },
        transaction[0]._id
      );

      // Update the profile's myPtsBalance and ProfileMypts fields
      await ProfileModel.findByIdAndUpdate(profileId, {
        myPtsBalance: myPts.balance,
        'ProfileMypts.currentBalance': myPts.balance,
        'ProfileMypts.lifetimeMypts': myPts.lifetimeEarned
      }, { session });

      await session.commitTransaction();

      // Notify the user of the withdrawal
      try {
        await notifyUserOfCompletedTransaction(transaction[0]);
        logger.info(`User notified of admin withdrawal: ${transaction[0]._id}`);
      } catch (notifyError) {
        logger.error(`Error notifying user of admin withdrawal: ${transaction[0]._id}`, notifyError);
        // Continue even if notification fails
      }

      // Notify admins
      await notifyAdminsOfTransaction(transaction[0]);

      return res.status(200).json({
        success: true,
        data: {
          transaction: transaction[0],
          newBalance: myPts.balance
        }
      });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error: any) {
    logger.error(`Error in admin withdrawal: ${error.message}`, { error });
    return res.status(500).json({ success: false, message: 'Failed to process admin withdrawal' });
  }
};

/**
 * Synchronize MyPts balances for all profiles
 * This ensures that the myPtsBalance field and ProfileMypts fields match the actual MyPts balance
 */
export const synchronizeMyPtsBalances = async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    const user = req.user as any
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    // Get all MyPts documents
    const myPtsDocuments = await MyPtsModel.find({});
    logger.info(`Found ${myPtsDocuments.length} MyPts documents to synchronize`);

    const results = {
      total: myPtsDocuments.length,
      updated: 0,
      errors: 0,
      details: [] as Array<{ profileId: string; status: string; message?: string }>
    };

    // Update each profile
    for (const myPts of myPtsDocuments) {
      try {
        // Update the profile document
        const updateResult = await ProfileModel.findByIdAndUpdate(myPts.profileId, {
          myPtsBalance: myPts.balance,
          'ProfileMypts.currentBalance': myPts.balance,
          'ProfileMypts.lifetimeMypts': myPts.lifetimeEarned
        });

        if (updateResult) {
          results.updated++;
          results.details.push({
            profileId: myPts.profileId.toString(),
            status: 'success'
          });
          logger.info(`Synchronized MyPts balance for profile: ${myPts.profileId}, balance: ${myPts.balance}, lifetimeEarned: ${myPts.lifetimeEarned}`);
        } else {
          results.errors++;
          results.details.push({
            profileId: myPts.profileId.toString(),
            status: 'error',
            message: 'Profile not found'
          });
          logger.error(`Failed to synchronize MyPts balance for profile: ${myPts.profileId} - Profile not found`);
        }
      } catch (error: any) {
        results.errors++;
        results.details.push({
          profileId: myPts.profileId.toString(),
          status: 'error',
          message: error.message
        });
        logger.error(`Error synchronizing MyPts balance for profile: ${myPts.profileId}`, { error });
      }
    }

    return res.status(200).json({
      success: true,
      data: results
    });
  } catch (error: any) {
    logger.error(`Error synchronizing MyPts balances: ${error.message}`, { error });
    return res.status(500).json({ success: false, message: 'Failed to synchronize MyPts balances' });
  }
};

/**
 * Get MyPts statistics for admin
 */
export const getMyPtsStats = async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    const user = req.user as any
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    // Get current hub state
    const hub = await myPtsHubService.getHubState();

    // Get total MyPts awarded by admins
    const totalAwarded = await MyPtsTransactionModel.aggregate([
      { $match: { type: TransactionType.ADJUSTMENT, amount: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Get total MyPts purchased (bought with real money)
    const totalPurchased = await MyPtsTransactionModel.aggregate([
      { $match: { type: TransactionType.BUY_MYPTS } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Get total MyPts sold (exchanged for real money)
    const totalSold = await MyPtsTransactionModel.aggregate([
      { $match: { type: TransactionType.SELL_MYPTS } },
      { $group: { _id: null, total: { $sum: { $abs: '$amount' } } } }
    ]);

    // Get total MyPts earned through activities
    const totalEarned = await MyPtsTransactionModel.aggregate([
      { $match: { type: TransactionType.EARN_MYPTS } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Get total MyPts in circulation (sum of all profile balances)
    const totalInCirculation = await MyPtsModel.aggregate([
      { $group: { _id: null, total: { $sum: '$balance' } } }
    ]);

    // Get transaction counts by type
    const transactionCounts = await MyPtsTransactionModel.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);

    // Format transaction counts as an object
    const transactionCountsByType: Record<string, number> = {};
    transactionCounts.forEach((item: any) => {
      transactionCountsByType[item._id] = item.count;
    });

    // Get monthly transaction totals for the last 12 months
    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const monthlyStats = await MyPtsTransactionModel.aggregate([
      {
        $match: {
          createdAt: { $gte: twelveMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            type: '$type'
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Format monthly stats
    const formattedMonthlyStats = [];
    for (let i = 0; i < 12; i++) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = targetDate.getFullYear();
      const month = targetDate.getMonth() + 1;

      const monthData: {
        year: number;
        month: number;
        label: string;
        transactions: Record<string, { total: number; count: number }>;
      } = {
        year,
        month,
        label: targetDate.toLocaleString('default', { month: 'short', year: 'numeric' }),
        transactions: {}
      };

      // Find stats for this month
      monthlyStats.forEach((stat: any) => {
        if (stat._id.year === year && stat._id.month === month) {
          monthData.transactions[stat._id.type as string] = {
            total: stat.total,
            count: stat.count
          };
        }
      });

      formattedMonthlyStats.push(monthData);
    }

    return res.status(200).json({
      success: true,
      data: {
        hubState: {
          totalSupply: hub.totalSupply,
          circulatingSupply: hub.circulatingSupply,
          reserveSupply: hub.reserveSupply,
          maxSupply: hub.maxSupply,
          valuePerMyPt: hub.valuePerMyPt
        },
        totalAwarded: totalAwarded.length > 0 ? totalAwarded[0].total : 0,
        totalPurchased: totalPurchased.length > 0 ? totalPurchased[0].total : 0,
        totalSold: totalSold.length > 0 ? totalSold[0].total : 0,
        totalEarned: totalEarned.length > 0 ? totalEarned[0].total : 0,
        totalInCirculation: totalInCirculation.length > 0 ? totalInCirculation[0].total : 0,
        transactionCountsByType,
        monthlyStats: formattedMonthlyStats.reverse() // Most recent first
      }
    });
  } catch (error: any) {
    logger.error(`Error getting MyPts statistics: ${error.message}`, { error });
    return res.status(500).json({ success: false, message: 'Failed to get MyPts statistics' });
  }
};

export const earnMyPts = async (req: Request, res: Response) => {
  try {
    if (!req.profile) {
      return res.status(401).json({ success: false, message: 'Profile not authenticated' });
    }

    const profile = req.profile as unknown as IProfile;
    const { activityType, referenceId } = req.body;

    if (!activityType) {
      return res.status(400).json({ success: false, message: 'Activity type is required' });
    }

    // Define MyPts earned for different activities
    const pointsMap: Record<string, number> = {
      'profile_completion': 50,
      'daily_login': 10,
      'post_creation': 5,
      'comment': 2,
      'share': 3,
      'referral': 100,
      'connection_accepted': 15
    };

    const amount = pointsMap[activityType] || 0;

    if (amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid activity type' });
    }

    const myPts = await profile.getMyPts();

    // Check if this activity has already been rewarded (for unique activities)
    if (referenceId && ['profile_completion', 'referral'].includes(activityType)) {
      const existingTransaction = await MyPtsTransactionModel.findOne({
        profileId: (profile._id as unknown as mongoose.Types.ObjectId).toString(),
        type: TransactionType.EARN_MYPTS,
        'metadata.activityType': activityType,
        'metadata.referenceId': referenceId
      });

      if (existingTransaction) {
        return res.status(400).json({
          success: false,
          message: 'MyPts already awarded for this activity'
        });
      }
    }

    // Get the hub and check reserve
    const hub = await myPtsHubService.getHubState();

    // Check if we need to issue new MyPts
    if (hub.reserveSupply < amount) {
      // Issue new MyPts to cover the amount
      await myPtsHubService.issueMyPts(
        amount,
        `Automatic issuance for activity: ${activityType}`,
        undefined,
        { automatic: true, activityType, referenceId }
      );
    }

    // Start a session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    let transactionRecord;

    try {
      // Update MyPts document
      myPts.balance += amount;
      myPts.lifetimeEarned += amount;
      myPts.lastTransaction = new Date();
      await myPts.save({ session });

      // Create transaction record first
      const transaction = await MyPtsTransactionModel.create([{
        profileId: (profile._id as unknown as mongoose.Types.ObjectId).toString(),
        type: TransactionType.EARN_MYPTS,
        amount,
        balance: myPts.balance,
        description: `Earned ${amount} MyPts for ${activityType.replace('_', ' ')}`,
        metadata: { activityType, referenceId }
      }], { session });

      // Move MyPts from reserve to circulation and link with transaction
      const hubResult = await myPtsHubService.moveToCirculation(
        amount,
        `Earned through activity: ${activityType}`,
        undefined,
        { activityType, referenceId },
        transaction[0]._id
      );

      // Update transaction with hub log ID if available
      if (hubResult.logId) {
        await MyPtsTransactionModel.findByIdAndUpdate(
          transaction[0]._id,
          { hubLogId: hubResult.logId },
          { session }
        );
      }

      // Update the profile's myPtsBalance for quick access
      await ProfileModel.findByIdAndUpdate(profile._id, {
        myPtsBalance: myPts.balance
      }, { session });

      await session.commitTransaction();

      // Store the transaction for the response
      transactionRecord = transaction[0];
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }

    return res.status(200).json({
      success: true,
      data: {
        transaction: transactionRecord,
        newBalance: myPts.balance,
        myPtsEarned: amount
      }
    });
  } catch (error: any) {
    logger.error(`Error earning MyPts: ${error.message}`, { error });
    return res.status(500).json({ success: false, message: 'Failed to earn MyPts' });
  }
};
