import express from 'express';
import { VerificationController } from '../controllers/verification.controller';
import { protect } from '../middleware/auth.middleware';
import { attachProfile } from '../middleware/profile-auth.middleware';
import { uploadSingle } from '../middleware/upload.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { z } from 'zod';

const router = express.Router();

// Validation schemas
const initializeVerificationSchema = z.object({
  // No body parameters needed - uses authenticated user and profile data
});

const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
  profileId: z.string().min(1, 'Profile ID is required')
});

const verifyPhoneSchema = z.object({
  otp: z.string().length(6, 'OTP must be 6 digits')
});

const uploadKYCDocumentSchema = z.object({
  documentType: z.enum(['government_id', 'passport', 'drivers_license', 'proof_of_address', 'business_registration']),
  documentNumber: z.string().optional(),
  issuingCountry: z.string().optional(),
  expiryDate: z.string().optional().refine((date) => {
    if (!date) return true;
    return !isNaN(Date.parse(date));
  }, 'Invalid date format')
});

// Public routes (no authentication required)
router.post('/email/verify', validateRequest(verifyEmailSchema), VerificationController.verifyEmail);

// Protected routes (require authentication and profile)
router.use(protect);
router.use(attachProfile);

// Verification management routes
router.post('/initialize', validateRequest(initializeVerificationSchema), VerificationController.initializeVerification);
router.get('/status', VerificationController.getVerificationStatus);
router.get('/can-withdraw', VerificationController.checkWithdrawalEligibility);

// Email verification routes
router.post('/email/start', VerificationController.startEmailVerification);
router.post('/email/verify-otp', VerificationController.verifyEmailOTP);
router.post('/email/verify-otp', VerificationController.verifyEmailOTP);

// Phone verification routes
router.post('/phone/start', VerificationController.startPhoneVerification);
router.post('/phone/verify', validateRequest(verifyPhoneSchema), VerificationController.verifyPhone);

// KYC verification routes
router.get('/kyc/requirements', VerificationController.getKYCRequirements);
router.post('/kyc/upload',
  uploadSingle('document'),
  validateRequest(uploadKYCDocumentSchema),
  VerificationController.uploadKYCDocument
);

export default router;
