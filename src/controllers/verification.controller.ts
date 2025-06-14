import { Request, Response } from 'express';
import { VerificationService } from '../services/verification.service';
import { ProfileVerification } from '../models/profile-verification.model';
import { logger } from '../utils/logger';

export class VerificationController {
  /**
   * Initialize verification for a profile
   * @route POST /api/verification/initialize
   */
  static async initializeVerification(req: Request, res: Response) {
    try {
      if (!req.profile) {
        return res.status(401).json({ success: false, message: 'Profile not authenticated' });
      }

      const profile = req.profile as any;
      const user = req.user as any;

      if (!user) {
        return res.status(401).json({ success: false, message: 'User not authenticated' });
      }

      const result = await VerificationService.initializeVerification(
        profile._id.toString(),
        user._id.toString(),
        user.email,
        user.phoneNumber,
        user.formattedPhoneNumber || user.phoneNumber,
        user.countryOfResidence || 'US'
      );

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      logger.error('Error in initializeVerification:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * Get verification status for current profile
   * @route GET /api/verification/status
   */
  static async getVerificationStatus(req: Request, res: Response) {
    try {
      if (!req.profile) {
        return res.status(401).json({ success: false, message: 'Profile not authenticated' });
      }

      const profile = req.profile as any;
      const user = req.user as any;

      if (!user) {
        return res.status(401).json({ success: false, message: 'User not authenticated' });
      }

      let verification = await VerificationService.getVerificationStatus(profile._id.toString());

      // Auto-initialize verification if no record exists
      if (!verification) {
        logger.info(`Auto-initializing verification for profile ${profile._id}`);

        const initResult = await VerificationService.initializeVerification(
          profile._id.toString(),
          user._id.toString(),
          user.email,
          user.phoneNumber,
          user.formattedPhoneNumber || user.phoneNumber,
          user.countryOfResidence || 'US'
        );

        if (!initResult.success) {
          return res.status(500).json({
            success: false,
            message: 'Failed to initialize verification automatically'
          });
        }

        // Fetch the newly created verification record
        verification = await VerificationService.getVerificationStatus(profile._id.toString());

        if (!verification) {
          return res.status(500).json({
            success: false,
            message: 'Failed to retrieve verification after initialization'
          });
        }
      }

      res.status(200).json({
        success: true,
        data: {
          overallStatus: verification.overallStatus,
          verificationLevel: verification.verificationLevel,
          canWithdraw: verification.canWithdraw,
          canReceiveDonations: verification.canReceiveDonations,
          canCreateBusinessProfile: verification.canCreateBusinessProfile,
          withdrawalLimit: verification.withdrawalLimit,
          emailVerification: {
            status: verification.emailVerification.status,
            email: verification.emailVerification.email,
            verifiedAt: verification.emailVerification.verifiedAt
          },
          phoneVerification: {
            status: verification.phoneVerification.status,
            phoneNumber: verification.phoneVerification.formattedPhoneNumber,
            verifiedAt: verification.phoneVerification.verifiedAt
          },
          kycVerification: {
            status: verification.kycVerification.status,
            level: verification.kycVerification.level,
            submittedAt: verification.kycVerification.submittedAt,
            approvedAt: verification.kycVerification.approvedAt,
            rejectionReason: verification.kycVerification.rejectionReason,
            requiredDocuments: verification.kycVerification.requiredDocuments,
            documents: verification.kycVerification.documents.map(doc => ({
              type: doc.type,
              status: doc.status,
              submittedAt: doc.submittedAt,
              reviewedAt: doc.reviewedAt,
              rejectionReason: doc.rejectionReason
            }))
          },
          lastVerificationUpdate: verification.lastVerificationUpdate
        }
      });
    } catch (error) {
      logger.error('Error in getVerificationStatus:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * Start email verification
   * @route POST /api/verification/email/start
   */
  static async startEmailVerification(req: Request, res: Response) {
    try {
      if (!req.profile) {
        return res.status(401).json({ success: false, message: 'Profile not authenticated' });
      }

      const profile = req.profile as any;
      const user = req.user as any;

      if (!user) {
        return res.status(401).json({ success: false, message: 'User not authenticated' });
      }

      // Check if verification exists, auto-initialize if not
      let verification = await VerificationService.getVerificationStatus(profile._id.toString());

      if (!verification) {
        logger.info(`Auto-initializing verification for email verification - profile ${profile._id}`);

        const initResult = await VerificationService.initializeVerification(
          profile._id.toString(),
          user._id.toString(),
          user.email,
          user.phoneNumber,
          user.formattedPhoneNumber || user.phoneNumber,
          user.countryOfResidence || 'US'
        );

        if (!initResult.success) {
          return res.status(500).json({
            success: false,
            message: 'Failed to initialize verification automatically'
          });
        }
      }

      const result = await VerificationService.startEmailVerification(profile._id.toString());

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      logger.error('Error in startEmailVerification:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * Verify email with token (legacy method for email links)
   * @route POST /api/verification/email/verify
   */
  static async verifyEmail(req: Request, res: Response) {
    try {
      const { token, profileId } = req.body;

      if (!token || !profileId) {
        return res.status(400).json({ success: false, message: 'Token and profile ID are required' });
      }

      const result = await VerificationService.verifyEmail(profileId, token);

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      logger.error('Error in verifyEmail:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * Verify email with OTP (new method for OTP codes)
   * @route POST /api/verification/email/verify-otp
   */
  static async verifyEmailOTP(req: Request, res: Response) {
    try {
      if (!req.profile) {
        return res.status(401).json({ success: false, message: 'Profile not authenticated' });
      }

      const { otp } = req.body;

      if (!otp) {
        return res.status(400).json({ success: false, message: 'OTP is required' });
      }

      const profile = req.profile as any;
      const result = await VerificationService.verifyEmailOTP(profile._id.toString(), otp);

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      logger.error('Error in verifyEmailOTP:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * Start phone verification
   * @route POST /api/verification/phone/start
   */
  static async startPhoneVerification(req: Request, res: Response) {
    try {
      if (!req.profile) {
        return res.status(401).json({ success: false, message: 'Profile not authenticated' });
      }

      const profile = req.profile as any;
      const user = req.user as any;

      if (!user) {
        return res.status(401).json({ success: false, message: 'User not authenticated' });
      }

      // Check if verification exists, auto-initialize if not
      let verification = await VerificationService.getVerificationStatus(profile._id.toString());

      if (!verification) {
        logger.info(`Auto-initializing verification for phone verification - profile ${profile._id}`);

        const initResult = await VerificationService.initializeVerification(
          profile._id.toString(),
          user._id.toString(),
          user.email,
          user.phoneNumber,
          user.formattedPhoneNumber || user.phoneNumber,
          user.countryOfResidence || 'US'
        );

        if (!initResult.success) {
          return res.status(500).json({
            success: false,
            message: 'Failed to initialize verification automatically'
          });
        }
      }

      const result = await VerificationService.startPhoneVerification(profile._id.toString());

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      logger.error('Error in startPhoneVerification:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * Verify phone with OTP
   * @route POST /api/verification/phone/verify
   */
  static async verifyPhone(req: Request, res: Response) {
    try {
      if (!req.profile) {
        return res.status(401).json({ success: false, message: 'Profile not authenticated' });
      }

      const { otp } = req.body;

      if (!otp) {
        return res.status(400).json({ success: false, message: 'OTP is required' });
      }

      const profile = req.profile as any;
      const result = await VerificationService.verifyPhone(profile._id.toString(), otp);

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      logger.error('Error in verifyPhone:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * Upload KYC document
   * @route POST /api/verification/kyc/upload
   */
  static async uploadKYCDocument(req: Request, res: Response) {
    try {
      if (!req.profile) {
        return res.status(401).json({ success: false, message: 'Profile not authenticated' });
      }

      if (!req.file) {
        return res.status(400).json({ success: false, message: 'Document file is required' });
      }

      const { documentType, documentNumber, issuingCountry, expiryDate } = req.body;

      if (!documentType) {
        return res.status(400).json({ success: false, message: 'Document type is required' });
      }

      const profile = req.profile as any;
      const result = await VerificationService.uploadKYCDocument(
        profile._id.toString(),
        documentType,
        req.file,
        documentNumber,
        issuingCountry,
        expiryDate ? new Date(expiryDate) : undefined
      );

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      logger.error('Error in uploadKYCDocument:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * Get KYC requirements for current verification level
   * @route GET /api/verification/kyc/requirements
   */
  static async getKYCRequirements(req: Request, res: Response) {
    try {
      if (!req.profile) {
        return res.status(401).json({ success: false, message: 'Profile not authenticated' });
      }

      const profile = req.profile as any;
      const verification = await ProfileVerification.findOne({ profileId: profile._id });

      if (!verification) {
        return res.status(404).json({ success: false, message: 'Verification record not found' });
      }

      const requirements = {
        basic: ['government_id'],
        standard: ['government_id', 'proof_of_address'],
        premium: ['government_id', 'proof_of_address', 'business_registration']
      };

      const currentLevel = verification.kycVerification.level;
      const requiredDocs = requirements[currentLevel] || requirements.basic;

      res.status(200).json({
        success: true,
        data: {
          currentLevel,
          requiredDocuments: requiredDocs,
          uploadedDocuments: verification.kycVerification.documents.map(doc => ({
            type: doc.type,
            status: doc.status,
            submittedAt: doc.submittedAt
          })),
          withdrawalLimits: {
            basic: 100,
            standard: 1000,
            premium: 10000
          }
        }
      });
    } catch (error) {
      logger.error('Error in getKYCRequirements:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * Check if profile can withdraw (used by MyPts controller)
   * @route GET /api/verification/can-withdraw
   */
  static async checkWithdrawalEligibility(req: Request, res: Response) {
    try {
      if (!req.profile) {
        return res.status(401).json({ success: false, message: 'Profile not authenticated' });
      }

      const profile = req.profile as any;
      const verification = await ProfileVerification.findOne({ profileId: profile._id });

      if (!verification) {
        return res.status(200).json({
          success: true,
          canWithdraw: false,
          reason: 'Verification not initialized',
          withdrawalLimit: 0
        });
      }

      res.status(200).json({
        success: true,
        canWithdraw: verification.canWithdraw,
        reason: verification.canWithdraw ? 'Fully verified' : 'Verification incomplete',
        withdrawalLimit: verification.withdrawalLimit || 0,
        verificationLevel: verification.verificationLevel,
        overallStatus: verification.overallStatus
      });
    } catch (error) {
      logger.error('Error in checkWithdrawalEligibility:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
}
