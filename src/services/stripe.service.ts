import Stripe from 'stripe';
import { getStripe, stripeConfig } from '../config/stripe.config';
import { logger } from '../utils/logger';
import { TransactionStatus } from '../interfaces/my-pts.interface';

/**
 * Stripe Service
 * Handles all interactions with the Stripe API
 */
class StripeService {
  private stripe: Stripe;

  constructor() {
    logger.info('Initializing StripeService');
    this.stripe = getStripe();
    logger.info('StripeService initialized successfully');
  }

  /**
   * Create a payment intent for buying MyPts
   * @param amount Amount in cents (e.g., $10.00 = 1000)
   * @param currency Currency code (default: 'usd')
   * @param metadata Additional metadata for the payment
   * @returns Payment intent object
   */
  async createPaymentIntent(
    amount: number,
    currency: string = stripeConfig.currency,
    metadata: Record<string, any> = {}
  ): Promise<Stripe.PaymentIntent> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount,
        currency,
        metadata,
        payment_method_types: stripeConfig.paymentMethods,
      });

      logger.info('Created payment intent', { paymentIntentId: paymentIntent.id });
      return paymentIntent;
    } catch (error) {
      logger.error('Error creating payment intent', { error });
      throw error;
    }
  }

  /**
   * Retrieve a payment intent
   * @param paymentIntentId Payment intent ID
   * @returns Payment intent object
   */
  async retrievePaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      return paymentIntent;
    } catch (error) {
      logger.error('Error retrieving payment intent', { error, paymentIntentId });
      throw error;
    }
  }

  /**
   * Confirm a payment intent
   * @param paymentIntentId Payment intent ID
   * @param paymentMethodId Payment method ID
   * @returns Confirmed payment intent
   */
  async confirmPaymentIntent(
    paymentIntentId: string,
    paymentMethodId: string
  ): Promise<Stripe.PaymentIntent> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.confirm(paymentIntentId, {
        payment_method: paymentMethodId,
      });
      return paymentIntent;
    } catch (error) {
      logger.error('Error confirming payment intent', { error, paymentIntentId });
      throw error;
    }
  }

  /**
   * Cancel a payment intent
   * @param paymentIntentId Payment intent ID
   * @returns Cancelled payment intent
   */
  async cancelPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.cancel(paymentIntentId);
      return paymentIntent;
    } catch (error) {
      logger.error('Error cancelling payment intent', { error, paymentIntentId });
      throw error;
    }
  }

  /**
   * Create a refund
   * @param paymentIntentId Payment intent ID
   * @param amount Amount to refund (in cents)
   * @param reason Reason for refund
   * @returns Refund object
   */
  async createRefund(
    paymentIntentId: string,
    amount?: number,
    reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer'
  ): Promise<Stripe.Refund> {
    try {
      const refundParams: Stripe.RefundCreateParams = {
        payment_intent: paymentIntentId,
      };

      if (amount) {
        refundParams.amount = amount;
      }

      if (reason) {
        refundParams.reason = reason;
      }

      const refund = await this.stripe.refunds.create(refundParams);
      logger.info('Created refund', { refundId: refund.id, paymentIntentId });
      return refund;
    } catch (error) {
      logger.error('Error creating refund', { error, paymentIntentId });
      throw error;
    }
  }

  /**
   * Create a checkout session for buying MyPts
   * @param amount Amount in cents
   * @param currency Currency code
   * @param successUrl Success URL
   * @param cancelUrl Cancel URL
   * @param metadata Additional metadata
   * @returns Checkout session
   */
  async createCheckoutSession(
    amount: number,
    currency: string = stripeConfig.currency,
    successUrl: string,
    cancelUrl: string,
    metadata: Record<string, any> = {}
  ): Promise<Stripe.Checkout.Session> {
    try {
      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency,
              product_data: {
                name: 'MyPts Purchase',
                description: `Purchase of ${amount / 100} MyPts`,
              },
              unit_amount: amount,
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata,
      });

      logger.info('Created checkout session', { sessionId: session.id });
      return session;
    } catch (error) {
      logger.error('Error creating checkout session', { error });
      throw error;
    }
  }

  /**
   * Map Stripe payment status to transaction status
   * @param stripeStatus Stripe payment status
   * @returns Transaction status
   */
  mapPaymentStatus(stripeStatus: string): TransactionStatus {
    switch (stripeStatus) {
      case 'succeeded':
        return TransactionStatus.COMPLETED;
      case 'processing':
        return TransactionStatus.PENDING;
      case 'requires_payment_method':
      case 'requires_confirmation':
      case 'requires_action':
      case 'requires_capture':
        return TransactionStatus.PENDING;
      case 'canceled':
        return TransactionStatus.CANCELLED;
      default:
        return TransactionStatus.FAILED;
    }
  }

  /**
   * Convert MyPts amount to cents for Stripe
   * @param myPtsAmount MyPts amount
   * @param valuePerMyPt Value per MyPt in dollars
   * @returns Amount in cents
   */
  convertMyPtsToCents(myPtsAmount: number, valuePerMyPt: number): number {
    // Calculate the dollar amount
    const dollarAmount = myPtsAmount * valuePerMyPt;
    // Convert to cents (Stripe uses cents)
    return Math.round(dollarAmount * 100);
  }

  /**
   * Convert cents to MyPts amount
   * @param centsAmount Amount in cents
   * @param valuePerMyPt Value per MyPt in dollars
   * @returns MyPts amount
   */
  convertCentsToMyPts(centsAmount: number, valuePerMyPt: number): number {
    // Convert cents to dollars
    const dollarAmount = centsAmount / 100;
    // Calculate MyPts amount
    return Math.round(dollarAmount / valuePerMyPt);
  }

  /**
   * Create a transfer to a connected account (for selling MyPts)
   * @param amount Amount in cents
   * @param currency Currency code
   * @param destinationAccount Stripe connected account ID
   * @param metadata Additional metadata
   * @returns Transfer object
   */
  async createTransfer(
    amount: number,
    currency: string = stripeConfig.currency,
    destinationAccount: string,
    metadata: Record<string, any> = {}
  ): Promise<Stripe.Transfer> {
    try {
      logger.info('Creating Stripe transfer', {
        amount,
        currency,
        destinationAccount: destinationAccount.substring(0, 10) + '...'
      });

      const transfer = await this.stripe.transfers.create({
        amount,
        currency,
        destination: destinationAccount,
        metadata,
      });

      logger.info('Created Stripe transfer successfully', { transferId: transfer.id });
      return transfer;
    } catch (error) {
      logger.error('Error creating Stripe transfer', { error });
      throw error;
    }
  }

  /**
   * Get the Stripe balance
   * @returns Stripe balance
   */
  async getBalance(): Promise<Stripe.Balance> {
    try {
      const balance = await this.stripe.balance.retrieve();
      return balance;
    } catch (error) {
      logger.error('Error retrieving Stripe balance', { error });
      throw error;
    }
  }

  /**
   * Create a payout to a bank account or debit card
   * @param amount Amount in cents
   * @param currency Currency code
   * @param method Payout method ('standard' or 'instant')
   * @param destination Bank account or card ID
   * @param metadata Additional metadata
   * @returns Payout object
   */
  async createPayout(
    amount: number,
    currency: string = stripeConfig.currency,
    method: 'standard' | 'instant' = 'standard',
    destination?: string,
    metadata: Record<string, any> = {}
  ): Promise<Stripe.Payout> {
    try {
      logger.info('Creating Stripe payout', { amount, currency, method, destination });

      // Check if we're in test mode
      const isTestMode = stripeConfig.secretKey.startsWith('sk_test_');
      logger.info(`Stripe mode: ${isTestMode ? 'TEST' : 'LIVE'}`);

      // In test mode, we can create payouts without having a balance
      // In live mode, we need to have a balance to create payouts
      if (!isTestMode) {
        // Get the available balance
        const balance = await this.stripe.balance.retrieve();
        const availableBalance = balance.available.find(b => b.currency === currency);
        const availableAmount = availableBalance ? availableBalance.amount : 0;

        logger.info('Stripe available balance', {
          availableAmount,
          currency,
          requestedAmount: amount
        });

        if (availableAmount < amount) {
          logger.error('Insufficient Stripe balance for payout', {
            availableAmount,
            requestedAmount: amount,
            currency
          });

          throw new Error(`Insufficient Stripe balance for payout. Available: ${availableAmount/100} ${currency.toUpperCase()}, Requested: ${amount/100} ${currency.toUpperCase()}`);
        }
      }

      // Ensure all metadata values are strings
      const stringifiedMetadata: Record<string, string> = {};
      Object.entries(metadata).forEach(([key, value]) => {
        stringifiedMetadata[key] = typeof value === 'string' ? value : String(value);
      });

      logger.info('Stringified metadata for Stripe payout', { stringifiedMetadata });

      const payoutParams: Stripe.PayoutCreateParams = {
        amount,
        currency,
        method,
        metadata: stringifiedMetadata,
      };

      if (destination) {
        payoutParams.destination = destination;
        logger.info('Using custom destination for payout', {
          destinationPrefix: destination.substring(0, 8) + '...'
        });
      } else {
        logger.info('Using default destination for payout');
      }

      const payout = await this.stripe.payouts.create(payoutParams);

      logger.info('Created Stripe payout successfully', {
        payoutId: payout.id,
        status: payout.status,
        amount: payout.amount,
        currency: payout.currency,
        arrivalDate: payout.arrival_date ? new Date(payout.arrival_date * 1000).toISOString() : 'unknown'
      });

      return payout;
    } catch (error) {
      // Log detailed error information
      if (error instanceof Stripe.errors.StripeError) {
        logger.error('Stripe error creating payout', {
          type: error.type,
          code: error.code,
          message: error.message,
          param: error.param
        });
      } else {
        logger.error('Error creating Stripe payout', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      throw error;
    }
  }

  /**
   * Create an external account (bank account) for a connected account
   * @param connectedAccountId Stripe connected account ID
   * @param bankAccountToken Bank account token
   * @returns External account object
   */
  async createExternalAccount(
    connectedAccountId: string,
    bankAccountToken: string
  ): Promise<Stripe.BankAccount> {
    try {
      logger.info('Creating external account for connected account', {
        connectedAccountId: connectedAccountId.substring(0, 10) + '...'
      });

      const bankAccount = await this.stripe.accounts.createExternalAccount(
        connectedAccountId,
        {
          external_account: bankAccountToken,
        }
      ) as Stripe.BankAccount;

      logger.info('Created external account successfully', {
        bankAccountId: bankAccount.id
      });

      return bankAccount;
    } catch (error) {
      logger.error('Error creating external account', { error });
      throw error;
    }
  }
}

// Export a singleton instance
export const stripeService = new StripeService();
