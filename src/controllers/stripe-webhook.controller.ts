import { Request, Response } from 'express';
import Stripe from 'stripe';
import mongoose from 'mongoose';
import { getStripe, stripeConfig } from '../config/stripe.config';
import { logger } from '../utils/logger';
import { MyPtsTransactionModel } from '../models/my-pts.model';
import { TransactionStatus } from '../interfaces/my-pts.interface';
import { ProfileModel } from '../models/profile.model';
import { myPtsHubService } from '../services/my-pts-hub.service';
import { notifyAdminsOfTransaction } from '../services/admin-notification.service';

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

  // Find the transaction by reference ID (payment intent ID)
  const transaction = await MyPtsTransactionModel.findOne({
    referenceId: paymentIntent.id,
  });

  if (!transaction) {
    logger.error('Transaction not found for payment intent', { paymentIntentId: paymentIntent.id });
    return;
  }

  // Update transaction status if it's not already completed
  if (transaction.status !== TransactionStatus.COMPLETED) {
    // Get profile
    const profile = await ProfileModel.findById(transaction.profileId);
    if (!profile) {
      logger.error('Profile not found for transaction', {
        transactionId: transaction._id,
        profileId: transaction.profileId
      });
      return;
    }

    // Get the MyPts document
    const myPts = await profile.getMyPts();

    // Update MyPts balance
    myPts.balance += transaction.amount;
    myPts.lifetimeEarned += transaction.amount;
    myPts.lastTransaction = new Date();
    await myPts.save();

    // Update profile's myPtsBalance for quick access
    await ProfileModel.findByIdAndUpdate(profile._id, {
      myPtsBalance: myPts.balance
    });

    // Update transaction status
    transaction.status = TransactionStatus.COMPLETED;
    transaction.balance = myPts.balance; // Update the balance in the transaction
    await transaction.save();

    // Move MyPts from reserve to circulation
    const hub = await myPtsHubService.getHubState();
    if (hub.reserveSupply < transaction.amount) {
      // If not enough in reserve, issue more MyPts
      await myPtsHubService.issueMyPts(
        transaction.amount - hub.reserveSupply,
        `Automatic issuance for purchase by profile ${profile._id}`,
        undefined,
        { automatic: true, profileId: (profile._id as unknown as mongoose.Types.ObjectId).toString() }
      );
    }

    // Move from reserve to circulation
    await myPtsHubService.moveToCirculation(
      transaction.amount,
      `Purchase by profile ${profile._id}`,
      undefined,
      {
        profileId: (profile._id as unknown as mongoose.Types.ObjectId).toString(),
        transactionId: transaction._id.toString()
      }
    );

    // Notify admins
    await notifyAdminsOfTransaction(transaction);

    logger.info('Transaction completed and MyPts balance updated', {
      transactionId: transaction._id,
      profileId: transaction.profileId,
      amount: transaction.amount,
      newBalance: myPts.balance
    });
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
  const profile = await ProfileModel.findById(profileId);
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

  // Move MyPts from reserve to circulation
  const hub = await myPtsHubService.getHubState();
  if (hub.reserveSupply < amount) {
    // If not enough in reserve, issue more MyPts
    await myPtsHubService.issueMyPts(
      amount - hub.reserveSupply,
      `Automatic issuance for purchase by profile ${profile._id}`,
      undefined,
      { automatic: true, profileId: (profile._id as unknown as mongoose.Types.ObjectId).toString() }
    );
  }

  // Move from reserve to circulation
  await myPtsHubService.moveToCirculation(
    amount,
    `Purchase by profile ${profile._id}`,
    undefined,
    { profileId: (profile._id as unknown as mongoose.Types.ObjectId).toString(), transactionId: transaction._id.toString() }
  );

  // Notify admins
  await notifyAdminsOfTransaction(transaction);

  logger.info('MyPts purchase completed via checkout', {
    profileId,
    amount,
    transactionId: transaction._id,
  });
}
