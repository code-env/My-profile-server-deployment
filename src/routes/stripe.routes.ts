import express from 'express';
import { handleStripeWebhook } from '../controllers/stripe-webhook.controller';
import { protect } from '../middleware/auth.middleware';
import { stripeConfig } from '../config/stripe.config';

const router = express.Router();

/**
 * Stripe webhook endpoint
 * This endpoint receives events from Stripe and processes them
 * It should be publicly accessible but secured with the webhook secret
 */
router.post('/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

/**
 * Get Stripe publishable key
 * This endpoint returns the Stripe publishable key for the frontend
 */
router.get('/config', protect, (req, res) => {
  res.json({
    success: true,
    data: {
      publishableKey: stripeConfig.publishableKey,
      currency: stripeConfig.currency,
      paymentMethods: stripeConfig.paymentMethods
    }
  });
});

export default router;
