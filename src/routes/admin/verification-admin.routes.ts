import express from 'express';
import { VerificationAdminController } from '../../controllers/admin/verification-admin.controller';
import { protect, requireRoles } from '../../middleware/auth.middleware';
import { validateRequest } from '../../middleware/validation.middleware';
import { z } from 'zod';

const router = express.Router();

// Validation schemas
const reviewKYCDocumentSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required'),
  documentIndex: z.number().min(0, 'Document index must be a non-negative number'),
  action: z.enum(['approve', 'reject'], {
    errorMap: () => ({ message: 'Action must be either "approve" or "reject"' })
  }),
  rejectionReason: z.string().optional(),
  verificationLevel: z.enum(['basic', 'standard', 'premium']).optional()
}).refine((data) => {
  if (data.action === 'reject' && !data.rejectionReason) {
    return false;
  }
  return true;
}, {
  message: 'Rejection reason is required when rejecting a document',
  path: ['rejectionReason']
});

const flagVerificationSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required'),
  flagged: z.boolean(),
  flagReason: z.string().optional()
}).refine((data) => {
  if (data.flagged && !data.flagReason) {
    return false;
  }
  return true;
}, {
  message: 'Flag reason is required when flagging a verification',
  path: ['flagReason']
});

const profileActionSchema = z.object({
  action: z.enum(['approve', 'reject', 'reset'], {
    errorMap: () => ({ message: 'Action must be either "approve", "reject", or "reset"' })
  }),
  reason: z.string().optional(),
  verificationLevel: z.enum(['basic', 'standard', 'premium']).optional(),
  adminNotes: z.string().optional()
}).refine((data) => {
  if (data.action === 'reject' && !data.reason) {
    return false;
  }
  return true;
}, {
  message: 'Rejection reason is required when rejecting a profile',
  path: ['reason']
});

const getVerificationRequestsSchema = z.object({
  page: z.string().optional().transform((val) => val ? parseInt(val) : 1),
  limit: z.string().optional().transform((val) => val ? parseInt(val) : 20),
  status: z.enum(['unverified', 'partially_verified', 'fully_verified', 'expired']).optional(),
  verificationLevel: z.enum(['none', 'basic', 'standard', 'premium']).optional(),
  kycStatus: z.enum(['not_started', 'pending', 'under_review', 'approved', 'rejected']).optional(),
  flagged: z.enum(['true', 'false']).optional(),
  search: z.string().optional()
});

// Apply authentication and admin middleware to all routes
router.use(protect);
router.use(requireRoles("admin", "super admin"));

// Verification management routes
router.get('/requests', VerificationAdminController.getVerificationRequests);
router.get('/stats', VerificationAdminController.getVerificationStats);
router.get('/:profileId', VerificationAdminController.getVerificationDetails);

// Profile review routes
router.get('/profile/:profileId/review', VerificationAdminController.getProfileForReview);
router.post('/profile/:profileId/action', validateRequest(profileActionSchema), VerificationAdminController.performProfileAction);

// KYC review routes
router.post('/kyc/review', validateRequest(reviewKYCDocumentSchema), VerificationAdminController.reviewKYCDocument);

// Flagging routes
router.post('/flag', validateRequest(flagVerificationSchema), VerificationAdminController.flagVerification);

export default router;
