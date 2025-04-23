import express from 'express';
import {
  getMyPtsBalance,
  getTransactionHistory,
  getTransactionsByType,
  buyMyPts,
  sellMyPts,
  withdrawMyPts,
  purchaseProduct,
  donateMyPts,
  awardMyPts,
  earnMyPts,
  getAllProfileTransactions,
  getMyPtsStats
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
  accountDetails: z.object({
    bankName: z.string().min(1, 'Bank name is required'),
    accountNumber: z.string().min(1, 'Account number is required')
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

// Routes
router.get('/balance', protect, attachProfile, getMyPtsBalance);
router.get('/transactions', protect, attachProfile, getTransactionHistory);
router.get('/transactions/type/:type', protect, attachProfile, getTransactionsByType);

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
router.post('/award', protect, attachProfile, validateRequest(awardMyPtsSchema), awardMyPts);

export default router;
