import { ProfileVerification } from '../models/profile-verification.model';
import { ProfileModel } from '../models/profile.model';
import { User } from '../models/User';
import { logger } from '../utils/logger';
import EmailService from './email.service';
import mongoose from 'mongoose';

export interface AdminVerificationStats {
  totalPending: number;
  totalApproved: number;
  totalRejected: number;
  avgProcessingTime: number;
  pendingByType: {
    email: number;
    phone: number;
    kyc: number;
  };
}

export interface VerificationQueueItem {
  _id: string;
  profileId: string;
  userId: string;
  user: {
    fullName: string;
    email: string;
    username: string;
  };
  profile: {
    secondaryId: string;
    country: string;
    dateOfBirth: string;
  };
  emailVerification: any;
  phoneVerification: any;
  kycVerification: any;
  overallStatus: string;
  createdAt: Date;
  lastVerificationUpdate: Date;
  pendingSteps: string[];
}

export interface AdminAction {
  action: 'approve' | 'reject';
  type: 'email' | 'phone' | 'kyc';
  verificationId: string;
  reason?: string;
  adminNotes?: string;
  adminId: string;
}

export class AdminVerificationService {
  /**
   * Get verification statistics for admin dashboard
   */
  static async getVerificationStats(): Promise<AdminVerificationStats> {
    try {
      const [totalStats, pendingStats] = await Promise.all([
        ProfileVerification.aggregate([
          {
            $group: {
              _id: null,
              totalPending: {
                $sum: {
                  $cond: [
                    {
                      $or: [
                        { $eq: ['$emailVerification.status', 'pending'] },
                        { $eq: ['$phoneVerification.status', 'pending'] },
                        { $eq: ['$kycVerification.status', 'pending'] },
                        { $eq: ['$kycVerification.status', 'under_review'] }
                      ]
                    },
                    1,
                    0
                  ]
                }
              },
              totalApproved: {
                $sum: {
                  $cond: [
                    { $eq: ['$overallStatus', 'fully_verified'] },
                    1,
                    0
                  ]
                }
              },
              totalRejected: {
                $sum: {
                  $cond: [
                    {
                      $or: [
                        { $eq: ['$emailVerification.status', 'failed'] },
                        { $eq: ['$phoneVerification.status', 'failed'] },
                        { $eq: ['$kycVerification.status', 'rejected'] }
                      ]
                    },
                    1,
                    0
                  ]
                }
              }
            }
          }
        ]),
        ProfileVerification.aggregate([
          {
            $group: {
              _id: null,
              emailPending: {
                $sum: {
                  $cond: [{ $eq: ['$emailVerification.status', 'pending'] }, 1, 0]
                }
              },
              phonePending: {
                $sum: {
                  $cond: [{ $eq: ['$phoneVerification.status', 'pending'] }, 1, 0]
                }
              },
              kycPending: {
                $sum: {
                  $cond: [
                    {
                      $or: [
                        { $eq: ['$kycVerification.status', 'pending'] },
                        { $eq: ['$kycVerification.status', 'under_review'] }
                      ]
                    },
                    1,
                    0
                  ]
                }
              }
            }
          }
        ])
      ]);

      const stats = totalStats[0] || { totalPending: 0, totalApproved: 0, totalRejected: 0 };
      const pending = pendingStats[0] || { emailPending: 0, phonePending: 0, kycPending: 0 };

      // Calculate average processing time (simplified - could be more sophisticated)
      const avgProcessingTime = 24; // hours - placeholder for now

      return {
        totalPending: stats.totalPending,
        totalApproved: stats.totalApproved,
        totalRejected: stats.totalRejected,
        avgProcessingTime,
        pendingByType: {
          email: pending.emailPending,
          phone: pending.phonePending,
          kyc: pending.kycPending
        }
      };
    } catch (error) {
      logger.error('Error getting verification stats:', error);
      throw new Error('Failed to get verification statistics');
    }
  }

  /**
   * Get verification queue with user and profile data
   */
  static async getVerificationQueue(
    page: number = 1,
    limit: number = 20,
    filter: 'all' | 'pending' | 'approved' | 'rejected' = 'pending'
  ): Promise<{ items: VerificationQueueItem[]; total: number; pages: number }> {
    try {
      const skip = (page - 1) * limit;

      // Build filter conditions
      let matchConditions: any = {};

      if (filter === 'pending') {
        matchConditions = {
          $or: [
            { 'emailVerification.status': 'pending' },
            { 'phoneVerification.status': 'pending' },
            { 'kycVerification.status': { $in: ['pending', 'under_review'] } }
          ]
        };
      } else if (filter === 'approved') {
        matchConditions = { overallStatus: 'fully_verified' };
      } else if (filter === 'rejected') {
        matchConditions = {
          $or: [
            { 'emailVerification.status': 'failed' },
            { 'phoneVerification.status': 'failed' },
            { 'kycVerification.status': 'rejected' }
          ]
        };
      }

      const pipeline: any[] = [
        { $match: matchConditions },
        {
          $lookup: {
            from: 'profiles',
            localField: 'profileId',
            foreignField: '_id',
            as: 'profile'
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user'
          }
        },
        { $unwind: '$profile' },
        { $unwind: '$user' },
        {
          $addFields: {
            pendingSteps: {
              $filter: {
                input: [
                  {
                    $cond: [
                      { $eq: ['$emailVerification.status', 'pending'] },
                      'email',
                      null
                    ]
                  },
                  {
                    $cond: [
                      { $eq: ['$phoneVerification.status', 'pending'] },
                      'phone',
                      null
                    ]
                  },
                  {
                    $cond: [
                      { $in: ['$kycVerification.status', ['pending', 'under_review']] },
                      'kyc',
                      null
                    ]
                  }
                ],
                cond: { $ne: ['$$this', null] }
              }
            }
          }
        },
        { $sort: { lastVerificationUpdate: -1, createdAt: -1 } },
        {
          $project: {
            _id: 1,
            profileId: 1,
            userId: 1,
            user: {
              fullName: '$user.fullName',
              email: '$user.email',
              username: '$user.username'
            },
            profile: {
              secondaryId: '$profile.secondaryId',
              country: '$profile.country',
              dateOfBirth: '$profile.dateOfBirth'
            },
            emailVerification: 1,
            phoneVerification: 1,
            kycVerification: 1,
            overallStatus: 1,
            createdAt: 1,
            lastVerificationUpdate: 1,
            pendingSteps: 1
          }
        }
      ];

      const [items, totalCount] = await Promise.all([
        ProfileVerification.aggregate([...pipeline, { $skip: skip }, { $limit: limit }]),
        ProfileVerification.aggregate([...pipeline, { $count: 'total' }])
      ]);

      const total = totalCount[0]?.total || 0;
      const pages = Math.ceil(total / limit);

      return {
        items: items as VerificationQueueItem[],
        total,
        pages
      };
    } catch (error) {
      logger.error('Error getting verification queue:', error);
      throw new Error('Failed to get verification queue');
    }
  }

  /**
   * Process admin action on verification request
   */
  static async processVerificationAction(action: AdminAction): Promise<{ success: boolean; message: string }> {
    try {
      const verification = await ProfileVerification.findById(action.verificationId);
      if (!verification) {
        return { success: false, message: 'Verification record not found' };
      }

      const now = new Date();
      let updateFields: any = {};
      let historyAction = '';
      let emailNotification = false;

      // Process based on verification type and action
      if (action.type === 'email') {
        if (action.action === 'approve') {
          updateFields['emailVerification.status'] = 'verified';
          updateFields['emailVerification.verifiedAt'] = now;
          historyAction = 'EMAIL_APPROVED_BY_ADMIN';
          emailNotification = true;
        } else {
          updateFields['emailVerification.status'] = 'failed';
          updateFields['emailVerification.rejectionReason'] = action.reason;
          historyAction = 'EMAIL_REJECTED_BY_ADMIN';
        }
      } else if (action.type === 'phone') {
        if (action.action === 'approve') {
          updateFields['phoneVerification.status'] = 'verified';
          updateFields['phoneVerification.verifiedAt'] = now;
          historyAction = 'PHONE_APPROVED_BY_ADMIN';
          emailNotification = true;
        } else {
          updateFields['phoneVerification.status'] = 'failed';
          updateFields['phoneVerification.rejectionReason'] = action.reason;
          historyAction = 'PHONE_REJECTED_BY_ADMIN';
        }
      } else if (action.type === 'kyc') {
        if (action.action === 'approve') {
          updateFields['kycVerification.status'] = 'approved';
          updateFields['kycVerification.approvedAt'] = now;
          updateFields['kycVerification.approvedBy'] = action.adminId;
          historyAction = 'KYC_APPROVED_BY_ADMIN';
          emailNotification = true;
        } else {
          updateFields['kycVerification.status'] = 'rejected';
          updateFields['kycVerification.rejectionReason'] = action.reason;
          updateFields['kycVerification.rejectedAt'] = now;
          updateFields['kycVerification.rejectedBy'] = action.adminId;
          historyAction = 'KYC_REJECTED_BY_ADMIN';
        }
      }

      // Add admin notes if provided
      if (action.adminNotes) {
        updateFields[`${action.type}Verification.adminNotes`] = action.adminNotes;
      }

      updateFields.lastVerificationUpdate = now;

      // Update the verification record
      await ProfileVerification.findByIdAndUpdate(action.verificationId, updateFields);

      // Add history entry
      verification.addHistoryEntry(historyAction, action.action === 'approve' ? 'verified' : 'failed', action.adminId);
      await verification.save();

      // Send email notification if approved
      if (emailNotification) {
        try {
          const user = await User.findById(verification.userId);
          if (user) {
            const verificationTypeText = action.type === 'kyc' ? 'identity' : action.type;
            await EmailService.sendVerificationApprovalEmail(
              user.email,
              user.fullName,
              verificationTypeText
            );
          }
        } catch (emailError) {
          logger.error('Failed to send approval email:', emailError);
          // Don't fail the main operation if email fails
        }
      }

      logger.info(`Admin ${action.adminId} ${action.action}ed ${action.type} verification for ${verification.profileId}`);

      return {
        success: true,
        message: `${action.type} verification ${action.action}ed successfully`
      };
    } catch (error) {
      logger.error('Error processing verification action:', error);
      return { success: false, message: 'Failed to process verification action' };
    }
  }

  /**
   * Bulk process verification actions
   */
  static async bulkProcessVerifications(
    actions: AdminAction[]
  ): Promise<{ success: number; failed: number; results: any[] }> {
    const results = [];
    let success = 0;
    let failed = 0;

    for (const action of actions) {
      try {
        const result = await this.processVerificationAction(action);
        if (result.success) {
          success++;
        } else {
          failed++;
        }
        results.push({ verificationId: action.verificationId, ...result });
      } catch (error) {
        failed++;
        results.push({
          verificationId: action.verificationId,
          success: false,
          message: 'Processing failed'
        });
      }
    }

    return { success, failed, results };
  }
}
