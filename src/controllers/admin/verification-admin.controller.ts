import { Request, Response } from 'express';
import { ProfileVerification } from '../../models/profile-verification.model';
import { ProfileModel } from '../../models/profile.model';
import { User } from '../../models/User';
import { logger } from '../../utils/logger';
import mongoose from 'mongoose';

export class VerificationAdminController {
  /**
   * Get all verification requests with pagination and filtering
   * @route GET /api/admin/verification/requests
   */
  static async getVerificationRequests(req: Request, res: Response) {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        verificationLevel,
        kycStatus,
        flagged,
        search
      } = req.query;

      const skip = (Number(page) - 1) * Number(limit);

      // Build filter query
      const filter: any = {};

      if (status) filter.overallStatus = status;
      if (verificationLevel) filter.verificationLevel = verificationLevel;
      if (kycStatus) filter['kycVerification.status'] = kycStatus;
      if (flagged === 'true') filter.flagged = true;

      // Search functionality
      let userIds: mongoose.Types.ObjectId[] = [];
      if (search) {
        const users = await User.find({
          $or: [
            { email: { $regex: search, $options: 'i' } },
            { fullName: { $regex: search, $options: 'i' } },
            { username: { $regex: search, $options: 'i' } }
          ]
        }).select('_id');
        userIds = users.map(user => user._id);

        if (userIds.length > 0) {
          filter.userId = { $in: userIds };
        } else {
          // If no users found, return empty result
          return res.status(200).json({
            success: true,
            data: {
              verifications: [],
              pagination: {
                currentPage: Number(page),
                totalPages: 0,
                totalItems: 0,
                itemsPerPage: Number(limit)
              }
            }
          });
        }
      }

      // Get total count for pagination
      const totalItems = await ProfileVerification.countDocuments(filter);
      const totalPages = Math.ceil(totalItems / Number(limit));

      // Get verification requests with complete population
      const verifications = await ProfileVerification.find(filter)
        .populate('userId', 'email fullName username profileImage dateOfBirth countryOfResidence phoneNumber')
        .populate('profileId', 'profileInformation ProfileFormat profileType secondaryId profileLocation')
        .populate('kycVerification.documents.reviewedBy', 'email fullName')
        .populate('flaggedBy', 'email fullName')
        .sort({ lastVerificationUpdate: -1 })
        .skip(skip)
        .limit(Number(limit));

      res.status(200).json({
        success: true,
        data: {
          verifications: verifications, // Return complete, unfiltered documents with population
          pagination: {
            currentPage: Number(page),
            totalPages,
            totalItems,
            itemsPerPage: Number(limit)
          }
        }
      });
    } catch (error) {
      logger.error('Error in getVerificationRequests:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * Get detailed verification information for a specific profile
   * @route GET /api/admin/verification/:profileId
   */
  static async getVerificationDetails(req: Request, res: Response) {
    try {
      const { profileId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(profileId)) {
        return res.status(400).json({ success: false, message: 'Invalid profile ID' });
      }

      const verification = await ProfileVerification.findOne({ profileId })
        .populate('userId', 'email fullName username profileImage dateOfBirth countryOfResidence phoneNumber')
        .populate('profileId', 'name profileImage profileType')
        .populate('verificationHistory.performedBy', 'email fullName')
        .populate('kycVerification.documents.reviewedBy', 'email fullName')
        .populate('flaggedBy', 'email fullName');

      if (!verification) {
        return res.status(404).json({ success: false, message: 'Verification record not found' });
      }

      res.status(200).json({
        success: true,
        data: verification
      });
    } catch (error) {
      logger.error('Error in getVerificationDetails:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * Review and approve/reject a KYC document
   * @route POST /api/admin/verification/kyc/review
   */
  static async reviewKYCDocument(req: Request, res: Response) {
    try {
      const user = req.user as any;
      const { profileId, documentIndex, action, rejectionReason, verificationLevel } = req.body;

      if (!profileId || documentIndex === undefined || !action) {
        return res.status(400).json({
          success: false,
          message: 'Profile ID, document index, and action are required'
        });
      }

      if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({
          success: false,
          message: 'Action must be either "approve" or "reject"'
        });
      }

      if (action === 'reject' && !rejectionReason) {
        return res.status(400).json({
          success: false,
          message: 'Rejection reason is required when rejecting a document'
        });
      }

      const verification = await ProfileVerification.findOne({ profileId });
      if (!verification) {
        return res.status(404).json({ success: false, message: 'Verification record not found' });
      }

      const document = verification.kycVerification.documents[documentIndex];
      if (!document) {
        return res.status(404).json({ success: false, message: 'Document not found' });
      }

      // Update document status
      document.status = action === 'approve' ? 'approved' : 'rejected';
      document.reviewedAt = new Date();
      document.reviewedBy = user._id;
      if (action === 'reject') {
        document.rejectionReason = rejectionReason;
      }

      // Check if all required documents are approved
      const requiredDocs = verification.kycVerification.requiredDocuments;
      const approvedDocs = verification.kycVerification.documents.filter(doc => doc.status === 'approved');
      const approvedDocTypes = approvedDocs.map(doc => doc.type);

      const allRequiredDocsApproved = requiredDocs.every(reqDoc =>
        approvedDocTypes.includes(reqDoc as 'government_id' | 'passport' | 'drivers_license' | 'proof_of_address' | 'business_registration')
      );

      // Update KYC verification status
      if (allRequiredDocsApproved) {
        verification.kycVerification.status = 'approved';
        verification.kycVerification.approvedAt = new Date();
        verification.kycVerification.reviewedAt = new Date();
        verification.kycVerification.reviewedBy = user._id;

        // Update verification level if provided
        if (verificationLevel && ['basic', 'standard', 'premium'].includes(verificationLevel)) {
          verification.verificationLevel = verificationLevel as any;
          verification.kycVerification.level = verificationLevel as any;
        }
      } else if (verification.kycVerification.documents.some(doc => doc.status === 'rejected')) {
        verification.kycVerification.status = 'rejected';
        verification.kycVerification.reviewedAt = new Date();
        verification.kycVerification.reviewedBy = user._id;
        verification.kycVerification.rejectionReason = rejectionReason;
      } else {
        verification.kycVerification.status = 'under_review';
      }

      await verification.save();

      // Add history entry
      verification.addHistoryEntry(
        `KYC_DOCUMENT_${action.toUpperCase()}`,
        verification.kycVerification.status,
        user._id,
        `Document ${documentIndex + 1} (${document.type}) ${action}d${rejectionReason ? `: ${rejectionReason}` : ''}`
      );
      await verification.save();

      res.status(200).json({
        success: true,
        message: `Document ${action}d successfully`,
        data: {
          documentStatus: document.status,
          kycStatus: verification.kycVerification.status,
          overallStatus: verification.overallStatus,
          canWithdraw: verification.canWithdraw
        }
      });
    } catch (error) {
      logger.error('Error in reviewKYCDocument:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * Flag or unflag a verification record
   * @route POST /api/admin/verification/flag
   */
  static async flagVerification(req: Request, res: Response) {
    try {
      const user = req.user as any;
      const { profileId, flagged, flagReason } = req.body;

      if (!profileId || flagged === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Profile ID and flagged status are required'
        });
      }

      if (flagged && !flagReason) {
        return res.status(400).json({
          success: false,
          message: 'Flag reason is required when flagging a verification'
        });
      }

      const verification = await ProfileVerification.findOne({ profileId });
      if (!verification) {
        return res.status(404).json({ success: false, message: 'Verification record not found' });
      }

      verification.flagged = flagged;
      verification.flagReason = flagged ? flagReason : undefined;
      verification.flaggedBy = flagged ? new mongoose.Types.ObjectId(user._id) : undefined;
      verification.flaggedAt = flagged ? new Date() : undefined;

      await verification.save();

      // Add history entry
      verification.addHistoryEntry(
        flagged ? 'VERIFICATION_FLAGGED' : 'VERIFICATION_UNFLAGGED',
        verification.overallStatus,
        new mongoose.Types.ObjectId(user._id),
        flagged ? flagReason : 'Flag removed'
      );
      await verification.save();

      res.status(200).json({
        success: true,
        message: `Verification ${flagged ? 'flagged' : 'unflagged'} successfully`,
        data: {
          flagged: verification.flagged,
          flagReason: verification.flagReason
        }
      });
    } catch (error) {
      logger.error('Error in flagVerification:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * Get comprehensive profile information for admin review
   * @route GET /api/admin/verification/profile/:profileId/review
   */
  static async getProfileForReview(req: Request, res: Response) {
    try {
      const { profileId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(profileId)) {
        return res.status(400).json({ success: false, message: 'Invalid profile ID' });
      }

      // Get verification record with complete population
      const verification = await ProfileVerification.findOne({ profileId })
        .populate('userId', 'email fullName username profileImage dateOfBirth countryOfResidence phoneNumber createdAt lastLogin accountType isEmailVerified isPhoneVerified')
        .populate('profileId', 'profileInformation ProfileFormat profileType secondaryId profileLocation verificationStatus ProfileMypts ProfileReferal createdAt updatedAt')
        .populate('verificationHistory.performedBy', 'email fullName')
        .populate('kycVerification.documents.reviewedBy', 'email fullName')
        .populate('flaggedBy', 'email fullName');

      if (!verification) {
        return res.status(404).json({ success: false, message: 'Verification record not found' });
      }

      // Get additional profile data
      const profile = verification.profileId as any;
      const user = verification.userId as any;

      // Calculate verification completion percentage
      let completionPercentage = 0;
      if (verification.emailVerification.status === 'verified') completionPercentage += 33;
      if (verification.phoneVerification.status === 'verified') completionPercentage += 33;
      if (verification.kycVerification.status === 'approved') completionPercentage += 34;

      // Get document review summary
      const documentSummary = {
        total: verification.kycVerification.documents.length,
        pending: verification.kycVerification.documents.filter(doc => doc.status === 'pending').length,
        approved: verification.kycVerification.documents.filter(doc => doc.status === 'approved').length,
        rejected: verification.kycVerification.documents.filter(doc => doc.status === 'rejected').length
      };

      // Prepare comprehensive response
      const reviewData = {
        verification: {
          id: verification._id,
          overallStatus: verification.overallStatus,
          verificationLevel: verification.verificationLevel,
          canWithdraw: verification.canWithdraw,
          canReceiveDonations: verification.canReceiveDonations,
          canCreateBusinessProfile: verification.canCreateBusinessProfile,
          withdrawalLimit: verification.withdrawalLimit,
          completionPercentage,
          flagged: verification.flagged,
          flagReason: verification.flagReason,
          flaggedBy: verification.flaggedBy,
          flaggedAt: verification.flaggedAt,
          createdAt: verification.createdAt,
          updatedAt: verification.updatedAt,
          lastVerificationUpdate: verification.lastVerificationUpdate
        },
        user: {
          id: user._id,
          email: user.email,
          fullName: user.fullName,
          username: user.username,
          profileImage: user.profileImage,
          dateOfBirth: user.dateOfBirth,
          countryOfResidence: user.countryOfResidence,
          phoneNumber: user.phoneNumber,
          accountType: user.accountType,
          isEmailVerified: user.isEmailVerified,
          isPhoneVerified: user.isPhoneVerified,
          createdAt: user.createdAt,
          lastLogin: user.lastLogin
        },
        profile: {
          id: profile._id,
          secondaryId: profile.secondaryId,
          profileType: profile.profileType,
          profileInformation: profile.profileInformation,
          ProfileFormat: profile.ProfileFormat,
          profileLocation: profile.profileLocation,
          verificationStatus: profile.verificationStatus,
          ProfileMypts: profile.ProfileMypts,
          ProfileReferal: profile.ProfileReferal,
          createdAt: profile.createdAt,
          updatedAt: profile.updatedAt
        },
        emailVerification: verification.emailVerification,
        phoneVerification: verification.phoneVerification,
        kycVerification: {
          status: verification.kycVerification.status,
          level: verification.kycVerification.level,
          submittedAt: verification.kycVerification.submittedAt,
          reviewedAt: verification.kycVerification.reviewedAt,
          reviewedBy: verification.kycVerification.reviewedBy,
          approvedAt: verification.kycVerification.approvedAt,
          rejectionReason: verification.kycVerification.rejectionReason,
          documents: verification.kycVerification.documents,
          requiredDocuments: verification.kycVerification.requiredDocuments,
          expiresAt: verification.kycVerification.expiresAt,
          riskScore: verification.kycVerification.riskScore,
          complianceNotes: verification.kycVerification.complianceNotes,
          documentSummary
        },
        verificationHistory: verification.verificationHistory,
        adminNotes: verification.adminNotes
      };

      res.status(200).json({
        success: true,
        data: reviewData
      });
    } catch (error) {
      logger.error('Error in getProfileForReview:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * Approve or reject entire profile verification
   * @route POST /api/admin/verification/profile/:profileId/action
   */
  static async performProfileAction(req: Request, res: Response) {
    try {
      const user = req.user as any;
      const { profileId } = req.params;
      const { action, reason, verificationLevel, adminNotes } = req.body;

      if (!mongoose.Types.ObjectId.isValid(profileId)) {
        return res.status(400).json({ success: false, message: 'Invalid profile ID' });
      }

      if (!['approve', 'reject', 'reset'].includes(action)) {
        return res.status(400).json({
          success: false,
          message: 'Action must be either "approve", "reject", or "reset"'
        });
      }

      if (action === 'reject' && !reason) {
        return res.status(400).json({
          success: false,
          message: 'Rejection reason is required when rejecting a profile'
        });
      }

      const verification = await ProfileVerification.findOne({ profileId });
      if (!verification) {
        return res.status(404).json({ success: false, message: 'Verification record not found' });
      }

      const now = new Date();
      let statusUpdate = '';
      let historyAction = '';

      switch (action) {
        case 'approve':
          verification.overallStatus = 'fully_verified';
          verification.verificationLevel = verificationLevel || 'standard';
          verification.canWithdraw = true;
          verification.canReceiveDonations = true;
          verification.canCreateBusinessProfile = verificationLevel === 'premium';

          // Auto-approve all verification components
          verification.emailVerification.status = 'verified';
          verification.emailVerification.verifiedAt = now;
          verification.phoneVerification.status = 'verified';
          verification.phoneVerification.verifiedAt = now;
          verification.kycVerification.status = 'approved';
          verification.kycVerification.approvedAt = now;
          verification.kycVerification.reviewedAt = now;
          verification.kycVerification.reviewedBy = user._id;

          statusUpdate = 'Profile fully approved';
          historyAction = 'PROFILE_APPROVED';
          break;

        case 'reject':
          verification.overallStatus = 'unverified';
          verification.canWithdraw = false;
          verification.kycVerification.status = 'rejected';
          verification.kycVerification.rejectionReason = reason;
          verification.kycVerification.reviewedAt = now;
          verification.kycVerification.reviewedBy = user._id;

          statusUpdate = 'Profile rejected';
          historyAction = 'PROFILE_REJECTED';
          break;

        case 'reset':
          verification.overallStatus = 'unverified';
          verification.verificationLevel = 'none';
          verification.canWithdraw = false;
          verification.emailVerification.status = 'pending';
          verification.phoneVerification.status = 'pending';
          verification.kycVerification.status = 'not_started';
          verification.kycVerification.documents = [];

          statusUpdate = 'Profile verification reset';
          historyAction = 'PROFILE_RESET';
          break;
      }

      if (adminNotes) {
        verification.adminNotes = adminNotes;
      }

      verification.lastVerificationUpdate = now;
      await verification.save();

      // Add history entry
      verification.addHistoryEntry(
        historyAction,
        verification.overallStatus,
        user._id,
        reason || adminNotes || statusUpdate
      );
      await verification.save();

      res.status(200).json({
        success: true,
        message: statusUpdate,
        data: {
          overallStatus: verification.overallStatus,
          verificationLevel: verification.verificationLevel,
          canWithdraw: verification.canWithdraw,
          action: action,
          performedBy: user.email,
          performedAt: now
        }
      });
    } catch (error) {
      logger.error('Error in performProfileAction:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * Get verification statistics for admin dashboard
   * @route GET /api/admin/verification/stats
   */
  static async getVerificationStats(req: Request, res: Response) {
    try {
      const stats = await Promise.all([
        ProfileVerification.countDocuments({ overallStatus: 'unverified' }),
        ProfileVerification.countDocuments({ overallStatus: 'partially_verified' }),
        ProfileVerification.countDocuments({ overallStatus: 'fully_verified' }),
        ProfileVerification.countDocuments({ 'kycVerification.status': 'pending' }),
        ProfileVerification.countDocuments({ 'kycVerification.status': 'under_review' }),
        ProfileVerification.countDocuments({ flagged: true }),
        ProfileVerification.countDocuments({
          'kycVerification.documents': {
            $elemMatch: { status: 'pending' }
          }
        })
      ]);

      const [
        unverified,
        partiallyVerified,
        fullyVerified,
        kycPending,
        kycUnderReview,
        flagged,
        pendingDocuments
      ] = stats;

      res.status(200).json({
        success: true,
        data: {
          overallStats: {
            unverified,
            partiallyVerified,
            fullyVerified,
            total: unverified + partiallyVerified + fullyVerified
          },
          kycStats: {
            pending: kycPending,
            underReview: kycUnderReview,
            pendingDocuments
          },
          flaggedVerifications: flagged
        }
      });
    } catch (error) {
      logger.error('Error in getVerificationStats:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
}
