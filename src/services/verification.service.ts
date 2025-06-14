import { ProfileVerification, IProfileVerification } from '../models/profile-verification.model';
import CloudinaryService from './cloudinary.service';
import EmailService from './email.service';
import TwilioService from './twilio.service';
import { logger } from '../utils/logger';
import crypto from 'crypto';
import mongoose from 'mongoose';

// Simple OTP generator function
function generateOTP(length: number): string {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
}

export interface VerificationInitResult {
  success: boolean;
  message: string;
  verificationId?: string;
  data?: any;
}

export interface DocumentUploadResult {
  success: boolean;
  message: string;
  documentId?: string;
  documentUrl?: string;
}

export class VerificationService {
  private static cloudinaryService = new CloudinaryService();

  /**
   * Initialize verification for a profile
   */
  static async initializeVerification(
    profileId: string,
    userId: string,
    userEmail: string,
    userPhone: string,
    formattedPhone: string,
    countryCode: string
  ): Promise<VerificationInitResult> {
    try {
      // Check if verification already exists
      let verification = await ProfileVerification.findOne({ profileId });

      if (!verification) {
        // Create new verification record
        verification = new ProfileVerification({
          profileId: new mongoose.Types.ObjectId(profileId),
          userId: new mongoose.Types.ObjectId(userId),
          emailVerification: {
            email: userEmail,
            status: 'pending',
            attempts: 0
          },
          phoneVerification: {
            phoneNumber: userPhone,
            formattedPhoneNumber: formattedPhone,
            countryCode: countryCode,
            status: 'pending',
            attempts: 0
          },
          kycVerification: {
            status: 'not_started',
            level: 'basic',
            documents: [],
            requiredDocuments: ['government_id', 'proof_of_address']
          }
        });

        await verification.save();

        verification.addHistoryEntry('VERIFICATION_INITIALIZED', 'pending', new mongoose.Types.ObjectId(userId));
        await verification.save();
      }

      return {
        success: true,
        message: 'Verification initialized successfully',
        verificationId: (verification._id as mongoose.Types.ObjectId).toString(),
        data: {
          overallStatus: verification.overallStatus,
          verificationLevel: verification.verificationLevel,
          canWithdraw: verification.canWithdraw,
          emailStatus: verification.emailVerification.status,
          phoneStatus: verification.phoneVerification.status,
          kycStatus: verification.kycVerification.status
        }
      };
    } catch (error) {
      logger.error('Error initializing verification:', error);
      return {
        success: false,
        message: 'Failed to initialize verification'
      };
    }
  }

  /**
   * Start email verification process
   */
  static async startEmailVerification(profileId: string): Promise<VerificationInitResult> {
    try {
      const verification = await ProfileVerification.findOne({ profileId });
      if (!verification) {
        return { success: false, message: 'Verification record not found' };
      }

      // Generate 6-digit OTP code (same as registration)
      const otp = generateOTP(6);
      const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes (same as registration)

      verification.emailVerification.otp = otp;
      verification.emailVerification.otpExpiry = otpExpiry;
      verification.emailVerification.attempts += 1;
      verification.emailVerification.lastAttemptAt = new Date();

      await verification.save();

      // Send OTP email using the same template as registration
      await EmailService.sendAccountVerificationOTP(verification.emailVerification.email, otp);

      logger.info(`Email verification OTP for ${verification.emailVerification.email}: ${otp}`);

      verification.addHistoryEntry('EMAIL_OTP_SENT', 'pending');
      await verification.save();

      return {
        success: true,
        message: 'Email verification code sent successfully',
        data: {
          email: verification.emailVerification.email,
          expiresAt: otpExpiry
        }
      };
    } catch (error) {
      logger.error('Error starting email verification:', error);
      return { success: false, message: 'Failed to send email verification' };
    }
  }

  /**
   * Verify email with token (legacy method for email links)
   */
  static async verifyEmail(profileId: string, token: string): Promise<VerificationInitResult> {
    try {
      const verification = await ProfileVerification.findOne({ profileId });
      if (!verification) {
        return { success: false, message: 'Verification record not found' };
      }

      const emailVerification = verification.emailVerification;

      if (!emailVerification.verificationToken || emailVerification.verificationToken !== token) {
        return { success: false, message: 'Invalid verification token' };
      }

      if (emailVerification.tokenExpiry && new Date() > emailVerification.tokenExpiry) {
        return { success: false, message: 'Verification token has expired' };
      }

      // Mark email as verified
      emailVerification.status = 'verified';
      emailVerification.verifiedAt = new Date();
      emailVerification.verificationToken = undefined;
      emailVerification.tokenExpiry = undefined;

      await verification.save();

      verification.addHistoryEntry('EMAIL_VERIFIED', 'verified');
      await verification.save();

      return {
        success: true,
        message: 'Email verified successfully',
        data: { overallStatus: verification.overallStatus }
      };
    } catch (error) {
      logger.error('Error verifying email:', error);
      return { success: false, message: 'Failed to verify email' };
    }
  }

  /**
   * Verify email with OTP (new method for OTP codes)
   */
  static async verifyEmailOTP(profileId: string, otp: string): Promise<VerificationInitResult> {
    try {
      const verification = await ProfileVerification.findOne({ profileId });
      if (!verification) {
        return { success: false, message: 'Verification record not found' };
      }

      const emailVerification = verification.emailVerification;

      if (!emailVerification.otp || emailVerification.otp !== otp) {
        return { success: false, message: 'Invalid OTP' };
      }

      if (emailVerification.otpExpiry && new Date() > emailVerification.otpExpiry) {
        return { success: false, message: 'OTP has expired' };
      }

      // Mark email as verified
      emailVerification.status = 'verified';
      emailVerification.verifiedAt = new Date();
      emailVerification.otp = undefined;
      emailVerification.otpExpiry = undefined;

      await verification.save();

      verification.addHistoryEntry('EMAIL_OTP_VERIFIED', 'verified');
      await verification.save();

      return {
        success: true,
        message: 'Email verified successfully',
        data: { overallStatus: verification.overallStatus }
      };
    } catch (error) {
      logger.error('Error verifying email OTP:', error);
      return { success: false, message: 'Failed to verify email' };
    }
  }

  /**
   * Start phone verification process
   */
  static async startPhoneVerification(profileId: string): Promise<VerificationInitResult> {
    try {
      const verification = await ProfileVerification.findOne({ profileId });
      if (!verification) {
        return { success: false, message: 'Verification record not found' };
      }

      // Generate OTP
      const otp = generateOTP(6);
      const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      verification.phoneVerification.otp = otp;
      verification.phoneVerification.otpExpiry = otpExpiry;
      verification.phoneVerification.attempts += 1;
      verification.phoneVerification.lastAttemptAt = new Date();

      await verification.save();

      // Send OTP via SMS
      await TwilioService.sendOTPMessage(verification.phoneVerification.formattedPhoneNumber, otp);

      verification.addHistoryEntry('PHONE_OTP_SENT', 'pending');
      await verification.save();

      return {
        success: true,
        message: 'Phone verification OTP sent successfully',
        data: {
          phoneNumber: verification.phoneVerification.formattedPhoneNumber,
          maskedPhone: this.maskPhoneNumber(verification.phoneVerification.formattedPhoneNumber)
        }
      };
    } catch (error) {
      logger.error('Error starting phone verification:', error);
      return { success: false, message: 'Failed to send phone verification OTP' };
    }
  }

  /**
   * Verify phone with OTP
   */
  static async verifyPhone(profileId: string, otp: string): Promise<VerificationInitResult> {
    try {
      const verification = await ProfileVerification.findOne({ profileId });
      if (!verification) {
        return { success: false, message: 'Verification record not found' };
      }

      const phoneVerification = verification.phoneVerification;

      if (!phoneVerification.otp || phoneVerification.otp !== otp) {
        return { success: false, message: 'Invalid OTP' };
      }

      if (phoneVerification.otpExpiry && new Date() > phoneVerification.otpExpiry) {
        return { success: false, message: 'OTP has expired' };
      }

      // Mark phone as verified
      phoneVerification.status = 'verified';
      phoneVerification.verifiedAt = new Date();
      phoneVerification.otp = undefined;
      phoneVerification.otpExpiry = undefined;

      await verification.save();

      verification.addHistoryEntry('PHONE_VERIFIED', 'verified');
      await verification.save();

      return {
        success: true,
        message: 'Phone verified successfully',
        data: { overallStatus: verification.overallStatus }
      };
    } catch (error) {
      logger.error('Error verifying phone:', error);
      return { success: false, message: 'Failed to verify phone' };
    }
  }

  /**
   * Upload KYC document
   */
  static async uploadKYCDocument(
    profileId: string,
    documentType: string,
    file: Express.Multer.File,
    documentNumber?: string,
    issuingCountry?: string,
    expiryDate?: Date
  ): Promise<DocumentUploadResult> {
    try {
      const verification = await ProfileVerification.findOne({ profileId });
      if (!verification) {
        return { success: false, message: 'Verification record not found' };
      }

      // Upload document to Cloudinary
      const uploadResult = await this.cloudinaryService.uploadImage(file, {
        folder: `verification/${profileId}/kyc`,
        tags: ['kyc', 'verification', documentType]
      });

      // Create document record
      const document = {
        type: documentType as any,
        documentNumber,
        issuingCountry,
        documentUrl: uploadResult.secure_url,
        thumbnailUrl: uploadResult.secure_url, // Use same URL for thumbnail for now
        status: 'pending' as const,
        submittedAt: new Date(),
        expiryDate,
        metadata: {
          fileSize: file.size,
          mimeType: file.mimetype,
          originalName: file.originalname
        }
      };

      verification.kycVerification.documents.push(document);
      verification.kycVerification.status = 'pending';
      verification.kycVerification.submittedAt = new Date();

      await verification.save();

      verification.addHistoryEntry('KYC_DOCUMENT_UPLOADED', 'pending', undefined, `Document type: ${documentType}`);
      await verification.save();

      return {
        success: true,
        message: 'Document uploaded successfully',
        documentId: document.documentUrl,
        documentUrl: document.documentUrl
      };
    } catch (error) {
      logger.error('Error uploading KYC document:', error);
      return { success: false, message: 'Failed to upload document' };
    }
  }

  /**
   * Get verification status for a profile
   */
  static async getVerificationStatus(profileId: string): Promise<IProfileVerification | null> {
    try {
      return await ProfileVerification.findOne({ profileId })
        .populate('userId', 'email fullName')
        .populate('verificationHistory.performedBy', 'email fullName');
    } catch (error) {
      logger.error('Error getting verification status:', error);
      return null;
    }
  }

  /**
   * Utility method to mask phone number
   */
  private static maskPhoneNumber(phoneNumber: string): string {
    if (phoneNumber.length <= 4) return phoneNumber;
    const visiblePart = phoneNumber.slice(-4);
    const maskedPart = '*'.repeat(phoneNumber.length - 4);
    return maskedPart + visiblePart;
  }
}
