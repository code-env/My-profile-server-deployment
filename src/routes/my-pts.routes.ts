import express from 'express';
import {
  getMyPtsBalance,
  refreshMyPtsBalance,
  getTransactionHistory,
  getTransactionsByType,
  getTransactionByReference,
  getTransactionById,
  buyMyPts,
  sellMyPts,
  withdrawMyPts,
  purchaseProduct,
  donateMyPts,
  awardMyPts,
  earnMyPts,
  getAllProfileTransactions,
  getMyPtsStats,
  processSellTransaction,
  rejectSellTransaction,
  synchronizeMyPtsBalances,
  adminWithdrawMyPts
} from '../controllers/my-pts.controller';
import { protect } from '../middleware/auth.middleware';
import { attachProfile } from '../middleware/profile-auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { z } from 'zod';

const router = express.Router();

// Validation schemas
const buyPtsSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  paymentMethod: z.string().min(1, 'Payment method is required'),
  paymentId: z.string().optional()
});

const sellPtsSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  paymentMethod: z.string().min(1, 'Payment method is required'),
  accountDetails: z.record(z.string()).superRefine((data, ctx) => {
    // Get the payment method from the parent object
    const paymentMethod = ctx.path[0] === 'accountDetails' && ctx.path.length > 1
      ? (ctx as any).parent?.paymentMethod
      : undefined;

    if (paymentMethod === 'bank_transfer') {
      if (!data.accountName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Account name is required',
          path: ['accountName']
        });
      }
      if (!data.accountNumber) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Account number is required',
          path: ['accountNumber']
        });
      }
      // Bank name is optional now
    } else if (paymentMethod === 'paypal') {
      if (!data.email) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'PayPal email is required',
          path: ['email']
        });
      }
    } else if (paymentMethod === 'stripe') {
      // For Stripe, we'll validate in the controller
      // as we might use Stripe Elements in the future
    } else if (paymentMethod === 'crypto') {
      if (!data.walletAddress) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Wallet address is required',
          path: ['walletAddress']
        });
      }
      if (!data.cryptoType) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Cryptocurrency type is required',
          path: ['cryptoType']
        });
      }
    }
  })
});

const withdrawPtsSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  reason: z.string().optional()
});

const purchaseProductSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  toProfileId: z.string().min(1, 'Recipient profile ID is required'),
  productId: z.string().min(1, 'Product ID is required'),
  productName: z.string().min(1, 'Product name is required')
});

const donateMyPtsSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  toProfileId: z.string().min(1, 'Recipient profile ID is required'),
  message: z.string().optional()
});

const awardMyPtsSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required'),
  amount: z.number().positive('Amount must be positive'),
  reason: z.string().optional()
});

const processSellTransactionSchema = z.object({
  transactionId: z.string().min(1, 'Transaction ID is required'),
  paymentReference: z.string().optional(),
  notes: z.string().optional()
});

const rejectSellTransactionSchema = z.object({
  transactionId: z.string().min(1, 'Transaction ID is required'),
  reason: z.string().optional()
});

const earnMyPtsSchema = z.object({
  activityType: z.enum([
    'profile_completion',
    'daily_login',
    'post_creation',
    'comment',
    'share',
    'referral',
    'connection_accepted'
  ], {
    errorMap: () => ({ message: 'Invalid activity type' })
  }),
  referenceId: z.string().optional()
});

const adminWithdrawMyPtsSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required'),
  amount: z.number().positive('Amount must be positive'),
  reason: z.string().optional()
});

// Routes
router.get('/balance', protect, attachProfile, getMyPtsBalance);
router.get('/refresh-balance', protect, attachProfile, refreshMyPtsBalance);
router.get('/transactions', protect, attachProfile, getTransactionHistory);
router.get('/transactions/type/:type', protect, attachProfile, getTransactionsByType);
router.get('/transactions/reference/:referenceId', protect, attachProfile, getTransactionByReference);
router.get('/transactions/:transactionId', protect, attachProfile, getTransactionById);

// MyPts management
router.post('/buy', protect, attachProfile, validateRequest(buyPtsSchema), buyMyPts);
router.post('/sell', protect, attachProfile, validateRequest(sellPtsSchema), sellMyPts);
router.post('/withdraw', protect, attachProfile, validateRequest(withdrawPtsSchema), withdrawMyPts);
router.post('/earn', protect, attachProfile, validateRequest(earnMyPtsSchema), earnMyPts);

// Product and donation transactions
router.post('/purchase-product', protect, attachProfile, validateRequest(purchaseProductSchema), purchaseProduct);
router.post('/donate', protect, attachProfile, validateRequest(donateMyPtsSchema), donateMyPts);

// Admin routes
router.get('/admin/transactions', protect, getAllProfileTransactions);
router.get('/admin/stats', protect, getMyPtsStats);
router.post('/award', protect, validateRequest(awardMyPtsSchema), awardMyPts);
router.post('/admin/process-sell', protect, validateRequest(processSellTransactionSchema), processSellTransaction);
router.post('/admin/reject-sell', protect, validateRequest(rejectSellTransactionSchema), rejectSellTransaction);
router.post('/admin/synchronize-balances', protect, synchronizeMyPtsBalances);
router.post('/admin/withdraw', protect, validateRequest(adminWithdrawMyPtsSchema), adminWithdrawMyPts);

export default router;
