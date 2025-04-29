import { z } from 'zod';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';

dotenv.config();

/**
 * Stripe Configuration Schema
 */
const stripeConfigSchema = z.object({
  STRIPE_SECRET_KEY: z.string(),
  STRIPE_PUBLISHABLE_KEY: z.string(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_CURRENCY: z.string().default('usd'),
  STRIPE_PAYMENT_METHODS: z.array(z.string()).default(['card']),
  STRIPE_PAYMENT_MODE: z.enum(['payment', 'subscription', 'setup']).default('payment'),
});

/**
 * Stripe Configuration
 */
export const stripeConfig = {
  secretKey: process.env.STRIPE_SECRET_KEY || 'sk_test_your_test_key',
  publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_your_test_key',
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  currency: process.env.STRIPE_CURRENCY || 'usd',
  paymentMethods: (process.env.STRIPE_PAYMENT_METHODS || 'card').split(','),
  paymentMode: process.env.STRIPE_PAYMENT_MODE || 'payment',
  apiVersion: '2025-03-31.basil' as const, // Use the required API version
};

/**
 * Validate Stripe Configuration
 */
export function validateStripeConfig(): boolean {
  try {
    stripeConfigSchema.parse({
      STRIPE_SECRET_KEY: stripeConfig.secretKey,
      STRIPE_PUBLISHABLE_KEY: stripeConfig.publishableKey,
      STRIPE_WEBHOOK_SECRET: stripeConfig.webhookSecret,
      STRIPE_CURRENCY: stripeConfig.currency,
      STRIPE_PAYMENT_METHODS: stripeConfig.paymentMethods,
      STRIPE_PAYMENT_MODE: stripeConfig.paymentMode,
    });
    return true;
  } catch (error) {
    logger.error('Invalid Stripe configuration', { error });
    return false;
  }
}

/**
 * Initialize Stripe
 */
let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    logger.info('Initializing Stripe instance with API version', { apiVersion: stripeConfig.apiVersion });

    if (!stripeConfig.secretKey) {
      logger.error('Stripe secret key is not configured');
      throw new Error('Stripe secret key is not configured.');
    }

    if (stripeConfig.secretKey.includes('your_test_key')) {
      logger.warn('Using placeholder Stripe secret key. Please update with your actual Stripe keys.');
    }

    stripeInstance = new Stripe(stripeConfig.secretKey, {
      apiVersion: stripeConfig.apiVersion,
      typescript: true, // Recommended for better type safety
    });

    logger.info('Stripe instance initialized successfully');
  }
  return stripeInstance;
}
