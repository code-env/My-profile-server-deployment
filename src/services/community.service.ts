import { ProfileModel } from '../models/profile.model';
import mongoose from 'mongoose';
import createHttpError from 'http-errors';
import { NotificationService } from './notification.service';
import { CommunityGroupInvitation, ICommunityGroupInvitation } from '../models/community-group-invitation.model';
import { SettingsModel, SettingsDocument } from '../models/settings';
import ExcelJS from 'exceljs';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { stringify } from 'csv-stringify/sync';

const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || 'https://your-frontend.com';

export class CommunityService {

  async getShareLink(id: string) {
    const profile = await ProfileModel.findById(id);
    if (!profile || profile.profileType !== 'community') {
      throw createHttpError(404, 'Community not found');
    }
    return { link: profile.profileInformation.profileLink };
  }

  private generateJoinLink(invitationId: string) {
    return `${FRONTEND_BASE_URL}/community/invitations/${invitationId}/respond`;
  }

  async inviteExistingGroup(communityId: string, groupId: string, invitedBy: string, message?: string) {
    // Check community settings for invitation permissions
    const settings = await this.getCommunitySettings(communityId);
    const memberInvitePermission = settings.specificSettings?.get('memberInvitePermission') || 'admins';
    
    // Check if the inviter has permission based on community settings
    const community = await ProfileModel.findById(communityId);
    if (!community || community.profileType !== 'community') {
      throw createHttpError(404, 'Community not found');
    }
    
    // Check permissions based on community settings
    if (memberInvitePermission === 'admins') {
      // Only community creator/admin can invite
      if (community.profileInformation.creator.toString() !== invitedBy) {
        throw createHttpError(403, 'Only community administrators can invite groups');
      }
    } else if (memberInvitePermission === 'members') {
      // Check if inviter is a member of the community
      const isMember = community.members?.some((m: any) => m.toString() === invitedBy);
      const isCreator = community.profileInformation.creator.toString() === invitedBy;
      if (!isMember && !isCreator) {
        throw createHttpError(403, 'Only community members can invite groups');
      }
    }
    // If memberInvitePermission is 'anyone', no additional checks needed

    // Check if invitation already exists
    const existing = await CommunityGroupInvitation.findOne({ communityId, groupId });
    if (existing) {
      if (existing.status === 'pending') {
        throw createHttpError(409, 'An invitation is already pending for this group.');
      }
      if (existing.status === 'accepted') {
        throw createHttpError(409, 'This group is already a member of the community.');
      }
      if (existing.status === 'rejected') {
        // Optionally allow re-inviting after rejection, or throw error
        throw createHttpError(409, 'This group has already rejected the invitation.');
      }
      if (existing.status === 'cancelled') {
        // Reuse the cancelled invitation: set to pending, update invitedBy, clear respondedAt/message
        existing.status = 'pending';
        existing.invitedBy = new mongoose.Types.ObjectId(invitedBy);
        existing.createdAt = new Date();
        existing.respondedAt = undefined;
        existing.responseMessage = undefined;
        await existing.save();
        const joinLink = this.generateJoinLink(existing.id);
        // Send notification to group admin
        const groupProfile = await ProfileModel.findById(groupId);
        if (groupProfile) {
          const notificationService = new NotificationService();
          await notificationService.createNotification({
            recipient: groupProfile.profileInformation.creator,
            type: 'community_group_invitation_request',
            title: 'Community Invitation',
            message: message || `You have been invited to join a community.`,
            relatedTo: { model: 'Profile', id: communityId },
            link: joinLink,
          });
        }
        return { ...existing.toObject(), joinLink };
      }
    }
    // Create invitation
    const invitation = await CommunityGroupInvitation.create({
      communityId,
      groupId,
      invitedBy,
      status: 'pending',
    });
    // Generate join link
    const joinLink = this.generateJoinLink(invitation.id);
    // Send notification to group admin (assuming group profileInformation.creator is the admin)
    const groupProfile = await ProfileModel.findById(groupId);
    if (groupProfile) {
      const notificationService = new NotificationService();
      await notificationService.createNotification({
        recipient: groupProfile.profileInformation.creator,
        type: 'community_group_invitation_request',
        title: 'Community Invitation',
        message: message || `You have been invited to join a community.`,
        relatedTo: { model: 'Profile', id: communityId },
        link: joinLink,
      });
      // Optionally, send an email here using your email service
      // await emailService.sendGroupInvite({ to: groupProfile.email, joinLink, ... });
    }
    return { ...invitation.toObject(), joinLink };
  }

  async respondToGroupInvitation(invitationId: string, responderId: string, accept: boolean, responseMessage?: string) {
    const invitation = await CommunityGroupInvitation.findById(invitationId);
    if (!invitation) throw createHttpError(404, 'Invitation not found');
    if (invitation.status !== 'pending') throw createHttpError(400, 'Invitation already responded to');
    // Only group admin can respond
    const groupProfile = await ProfileModel.findById(invitation.groupId);
    if (!groupProfile) throw createHttpError(404, 'Group not found');
    if (groupProfile.profileInformation.creator.toString() !== responderId) {
      throw createHttpError(403, 'Only the group admin can respond to the invitation');
    }
    invitation.status = accept ? 'accepted' : 'rejected';
    invitation.respondedAt = new Date();
    invitation.responseMessage = responseMessage;
    await invitation.save();
    if (accept) {
      // Add group to community
      await ProfileModel.findByIdAndUpdate(invitation.communityId, {
        $addToSet: { groups: invitation.groupId },
      });
    }
    // Notify inviter
    const notificationService = new NotificationService();
    await notificationService.createNotification({
      recipient: invitation.invitedBy,
      type: 'community_group_invitation_response',
      title: 'Invitation Response',
      message: accept ? 'Invitation accepted.' : 'Invitation rejected.',
      relatedTo: { model: 'CommunityGroupInvitation', id: invitation._id },
    });
    return invitation;
  }

  async getPendingInvitationsForCommunity(communityId: string) {
    return CommunityGroupInvitation.find({ communityId, status: 'pending' });
  }

  async getPendingInvitationsForGroup(groupId: string) {
    return CommunityGroupInvitation.find({ groupId, status: 'pending' });
  }

  async broadcastWithinCommunity(communityId: string, message: string) {
    const profile = await ProfileModel.findById(communityId);
    if (!profile) throw createHttpError(404, 'Community not found');
    if (!profile.members || profile.members.length === 0) {
      throw createHttpError(400, 'No members to broadcast to');
    }

    // Check community notification settings
    const settings = await this.getCommunitySettings(communityId);
    const notificationSettings = settings.notifications;
    
    // Only send notifications if community allows them
    if (notificationSettings.general.allNotifications && notificationSettings.channels.push) {
    // Send notification to all members
    const notificationService = new NotificationService();
    await Promise.all(
      profile.members.map(memberId =>
        notificationService.createNotification({
          recipient: memberId,
          type: 'community_broadcast',
          title: 'Community Announcement',
          message,
          relatedTo: { model: 'Profile', id: communityId }
        })
      )
    );
    }

    // Store the broadcast in a section for history
    let section = profile.sections.find(s => s.key === 'broadcasts');
    if (!section) {
      section = {
        key: 'broadcasts',
        label: 'Broadcasts',
        order: profile.sections.length,
        fields: []
      };
      profile.sections.push(section);
    }
    section.fields.push({
      key: `broadcast_${Date.now()}`,
      label: 'Broadcast Message',
      widget: 'textarea',
      value: message,
      enabled: true
    });
    await profile.save();

    return { 
      broadcasted: true, 
      recipients: profile.members.length,
      notificationsSent: notificationSettings.general.allNotifications && notificationSettings.channels.push
    };
  }

  async reportCommunity(communityId: string, reason: string, details?: string, profileId?: string) {
    if (!profileId || !mongoose.Types.ObjectId.isValid(profileId)) {
      throw createHttpError(400, 'Invalid profileId');
    }
    
    const community = await ProfileModel.findById(communityId);
    if (!community) throw createHttpError(404, 'Community not found');
    
    // Check community moderation settings
    const settings = await this.getCommunitySettings(communityId);
    const moderationLevel = settings.specificSettings?.get('moderationLevel') || 'standard';
    const autoModeration = settings.specificSettings?.get('autoModeration') || false;
    const reportThreshold = settings.specificSettings?.get('reportThreshold') || 3;
    
    // Check if profileId is a member or group in the community
    const isMember = community.members?.some((m: any) => m.toString() === profileId);
    const isGroup = community.groups?.some((g: any) => g.toString() === profileId);
    if (!isMember && !isGroup) {
      throw createHttpError(403, 'Profile is not a member or group of this community');
    }
    
    // Check if reporting is allowed based on moderation settings
    if (moderationLevel === 'none') {
      throw createHttpError(403, 'Reporting is disabled for this community');
    }
    
    let section = community.sections.find(s => s.key === 'reports');
    if (!section) {
      section = {
        key: 'reports',
        label: 'Reports',
        order: community.sections.length,
        fields: []
      };
      community.sections.push(section);
    }
    
    // Add report to community sections
    const reportData: any = {
      reason,
      details,
      reportedAt: new Date(),
      reportedBy: profileId,
      moderationLevel,
      autoProcessed: autoModeration
    };
    
    // Check if auto-moderation should be applied
    if (autoModeration && reportThreshold > 0) {
      const reportCount = section.fields.filter(f => 
        f.value && typeof f.value === 'object' && f.value.reportedBy === profileId
      ).length;
      
      if (reportCount >= reportThreshold) {
        // Auto-action based on moderation level
        if (moderationLevel === 'strict') {
          // Could implement auto-removal or suspension here
          reportData.autoProcessed = true;
          reportData.autoAction = 'flagged_for_review';
        }
      }
    }
    
    section.fields.push({
      key: `report_${Date.now()}`,
      label: 'Report',
      widget: 'textarea',
      value: reportData,
      enabled: true
    });
    
    await community.save();
    
    // Send notification to community admin only if notifications are enabled
    const notificationSettings = settings.notifications;
    if (notificationSettings.general.allNotifications && notificationSettings.channels.push) {
    const notificationService = new NotificationService();
    await notificationService.createNotification({
      recipient: community.profileInformation.creator,
      type: 'community_report',
      title: 'Community Report',
      message: `A report has been made on the community by profile ${profileId}.`,
      relatedTo: { model: 'Profile', id: communityId },
    });
    }
    
    return { 
      reported: true, 
      moderationLevel,
      autoProcessed: autoModeration,
      reportThreshold 
    };
  }

  async exitCommunity(communityId: string, profileId: string) {
    const community = await ProfileModel.findById(communityId);
    if (!community) throw createHttpError(404, 'Community not found');
    
    // Check community settings for exit permissions
    const settings = await this.getCommunitySettings(communityId);
    const communityType = settings.specificSettings?.get('communityType') || 'public';
    const exitRestrictions = settings.specificSettings?.get('exitRestrictions') || 'allowed';
    
    // Check if profile is actually a member or group
    const isMember = community.members?.some((m: any) => m.toString() === profileId);
    const isGroup = community.groups?.some((g: any) => g.toString() === profileId);
    if (!isMember && !isGroup) {
      throw createHttpError(400, 'Profile is not a member or group of this community');
    }
    
    // Check exit restrictions based on community settings
    if (exitRestrictions === 'restricted') {
      // Only allow exit if user is not the creator
      if (community.profileInformation.creator.toString() === profileId) {
        throw createHttpError(403, 'Community creator cannot exit the community');
      }
    } else if (exitRestrictions === 'admin_approval') {
      // Could implement approval workflow here
      throw createHttpError(403, 'Exit requires administrator approval');
    }
    
    const update: any = {};
    if (isMember) update.$pull = { members: new mongoose.Types.ObjectId(profileId) };
    if (isGroup) update.$pull = { groups: new mongoose.Types.ObjectId(profileId) };
    
    const updated = await ProfileModel.findByIdAndUpdate(
      communityId,
      update,
      { new: true }
    );
    
    // Send notification to community admin if notifications are enabled
    const notificationSettings = settings.notifications;
    if (notificationSettings.general.allNotifications && notificationSettings.channels.push) {
      const notificationService = new NotificationService();
      await notificationService.createNotification({
        recipient: community.profileInformation.creator,
        type: 'community_member_exit',
        title: 'Member Left Community',
        message: `A ${isMember ? 'member' : 'group'} has left the community.`,
        relatedTo: { model: 'Profile', id: communityId },
      });
    }
    
    return {
      ...updated?.toObject(),
      exitType: isMember ? 'member' : 'group',
      communityType,
      exitRestrictions
    };
  }

  async getCommunitySettings(communityId: string): Promise<SettingsDocument> {
    // Check if community exists
    const community = await ProfileModel.findById(communityId);
    if (!community || community.profileType !== 'community') {
      throw createHttpError(404, 'Community not found');
    }

    // Find or create settings for this community
    let settings = await SettingsModel.findOne({ userId: communityId });
    
    if (!settings) {
      // Create default community settings
      settings = await SettingsModel.create({
        userId: communityId,
        general: {
          regional: {
            language: 'en',
            currency: 'USD',
            numberFormat: 'dot',
            dateFormat: 'MM/DD/YYYY',
            country: 'US',
            areaCode: '+1'
          },
          appSystem: {
            version: '1.0.0',
            build: '1.0.0',
            permissions: {
              camera: false,
              microphone: false,
              storage: true,
              notifications: true
            },
            storageCacheEnabled: true,
            allowNotifications: true,
            backgroundActivity: false,
            allowMobileData: true,
            optimizeBatteryUsage: true,
            batteryUsage: false
          },
          time: {
            dateFormat: 'MM/DD/YYYY',
            timeZone: 'UTC',
            timeFormat: '12h',
            calendarType: 'Gregorian',
            holidays: [],
            showWeekNumbers: false,
            weekStartDay: 'Monday',
            bufferTimeMinutes: 15,
            slotDurationMinutes: 60,
            dailyBriefingNotification: true,
            dailyReminder: false,
            maxBookingsPerDay: 10,
            isAvailable: true
          },
          behaviorAndAlerts: {
            soundsEnabled: true,
            vibrationPattern: 'default',
            hapticFeedback: true,
            appResponseSound: true
          },
          measurements: {
            distanceUnit: 'Kilometers',
            measurementSystem: 'Metric',
            parameterUnits: 'Metric'
          },
          appSections: {
            enabledModules: ['announcements', 'discussions', 'events', 'members'],
            layoutOrder: ['announcements', 'discussions', 'events', 'members']
          },
          scanner: {
            playSound: false,
            autoCapture: false,
            enableQRScan: true,
            autoScan: false,
            enableNFCScan: false,
            scanActions: {
              openProfile: true,
              saveContact: false,
              autoShare: false
            },
            autoAdjustBorders: true,
            allowManualAdjustAfterScan: true,
            useSystemCamera: true,
            importFromGallery: false,
            saveScansToPhotos: false,
            doubleFocus: false,
            showGridOverlay: false
          }
        },
        specificSettings: new Map([
          ['communityType', 'public'],
          ['joinApproval', 'automatic'],
          ['memberInvitePermission', 'admins'],
          ['postingPermission', 'members'],
          ['moderationLevel', 'standard']
        ]),
        notifications: {
          channels: {
            push: true,
            text: false,
            inApp: true,
            email: true
          },
          general: {
            allNotifications: true,
            frequency: 'immediate',
            sound: true,
            vibration: true
          },
          Account: {
            storageLevel: { push: true, text: false, inApp: true, email: true },
            transfer: { push: true, text: false, inApp: true, email: true },
            deactivateClose: { push: true, text: false, inApp: true, email: true }
          },
          Profile: {
            createDelete: { push: true, text: false, inApp: true, email: true },
            verification: { push: true, text: false, inApp: true, email: true },
            updates: { push: true, text: false, inApp: true, email: false },
            views: { push: false, text: false, inApp: true, email: false },
            invitations: { push: true, text: false, inApp: true, email: true },
            recomendations: { push: false, text: false, inApp: true, email: false },
            rewards: { push: true, text: false, inApp: true, email: false }
          },
          networking: {
            connections: { push: true, text: false, inApp: true, email: true },
            affiliations: { push: true, text: false, inApp: true, email: false },
            following: { push: false, text: false, inApp: true, email: false },
            invitation: { push: true, text: false, inApp: true, email: true },
            mutualRecommendation: { push: true, text: false, inApp: true, email: false },
            roleChanges: { push: true, text: false, inApp: true, email: true },
            circleUpdates: { push: true, text: false, inApp: true, email: false }
          },
          communication: {
            chat: { push: true, text: false, inApp: true, email: false },
            call: { push: true, text: false, inApp: true, email: false },
            post: { push: true, text: false, inApp: true, email: false },
            reactions: { push: false, text: false, inApp: true, email: false },
            inbox: { push: true, text: false, inApp: true, email: true },
            share: { push: true, text: false, inApp: true, email: false }
          },
          calendar: {
            assignmentParticipation: { push: true, text: false, inApp: true, email: true },
            outcome: { push: true, text: false, inApp: true, email: true },
            booking: { push: true, text: false, inApp: true, email: true },
            holidays: { push: false, text: false, inApp: true, email: false },
            celebration: { push: true, text: false, inApp: true, email: false },
            reminder: { push: true, text: false, inApp: true, email: true },
            scheduleShift: { push: true, text: false, inApp: true, email: true }
          },
          paymentMarketing: {
            payment: { push: true, text: false, inApp: true, email: true },
            payout: { push: true, text: false, inApp: true, email: true },
            myPts: { push: true, text: false, inApp: true, email: false },
            subscription: { push: true, text: false, inApp: true, email: true },
            refund: { push: true, text: false, inApp: true, email: true },
            promotions: { push: false, text: false, inApp: false, email: false },
            newProduct: { push: false, text: false, inApp: false, email: false },
            seasonalSalesEvents: { push: false, text: false, inApp: false, email: false },
            referralBonus: { push: true, text: false, inApp: true, email: false }
          },
          securityPrivacy: {
            newDeviceLogin: { push: true, text: false, inApp: true, email: true },
            suspiciousLogin: { push: true, text: false, inApp: true, email: true },
            passwordResetRequest: { push: true, text: false, inApp: true, email: true },
            passwordChangeConfirmation: { push: true, text: false, inApp: true, email: true },
            twoFactorAuth: { push: true, text: false, inApp: true, email: true },
            securityPrivacyChange: { push: true, text: false, inApp: true, email: true },
            blockedUnblockedActivity: { push: true, text: false, inApp: true, email: true },
            reportSubmissionConfirmation: { push: true, text: false, inApp: true, email: true },
            privacyBreach: { push: true, text: false, inApp: true, email: true }
          },
          appUpdates: {
            newFeatureRelease: { push: false, text: false, inApp: true, email: false },
            appVersionUpdate: { push: true, text: false, inApp: true, email: false },
            mandatoryUpdate: { push: true, text: false, inApp: true, email: true },
            betaFeatureAccess: { push: false, text: false, inApp: true, email: false },
            systemMaintenance: { push: true, text: false, inApp: true, email: true },
            resolvedBugNotice: { push: false, text: false, inApp: true, email: false }
          }
        },
        security: {
          general: {
            passcode: false,
            appLock: false,
            changeEmail: true,
            changePhone: true,
            changePassword: true,
            changePasscode: true,
            changeAppLock: true
          },
          authentication: {
            twoFactorAuth: false,
            googleAuthenticator: false,
            sessions: [],
            rememberDevice: true,
            OtpMethods: {
              email: true,
              phoneNumber: false
            }
          },
          privacy: {
            profileVisibility: 'public',
            searchVisibility: true,
            activityStatus: true,
            readReceipts: true,
            lastSeen: true,
            profilePhoto: true,
            onlineStatus: true
          },
          dataAndStorage: {
            autoDownloadPhotos: true,
            autoDownloadVideos: false,
            autoDownloadDocuments: false,
            storageOptimization: true,
            cacheSize: '100MB',
            autoDeleteOldChats: false,
            chatBackup: true,
            cloudSync: true
          }
        },
        privacy: {
          Visibility: {
            profile: {
              public: true,
              connections: true,
              groups: false,
              private: false
            },
            contact: {
              public: false,
              connections: true,
              groups: true,
              private: false
            },
            activity: {
              public: false,
              connections: true,
              groups: true,
              private: false
            },
            content: {
              public: true,
              connections: true,
              groups: true,
              private: false
            }
          },
          permissions: {
            canMessage: 'connections',
            canCall: 'connections',
            canViewProfile: 'public',
            canSendConnectionRequest: 'public',
            canTagInPosts: 'connections',
            canSeeOnlineStatus: 'connections'
          }
        },
        discovery: {
          searchable: true,
          showInSuggestions: true,
          allowLocationBasedDiscovery: true,
          showInNearby: true,
          discoverableByEmail: false,
          discoverableByPhone: false,
          showInDirectory: true,
          allowRecommendations: true
        },
        dataSettings: {
          dataUsage: 'standard',
          autoSync: true,
          backgroundSync: true,
          syncFrequency: 'realtime',
          compressionEnabled: true,
          offlineMode: false
        },
        blockingSettings: {
          blockedUsers: [],
          blockedKeywords: [],
          autoBlockSpam: true,
          blockUnknownUsers: false,
          blockNonConnections: false
        },
        pay: {
          defaultCurrency: 'USD',
          autoPayEnabled: false,
          paymentMethods: [],
          billingAddress: {},
          taxSettings: {},
          invoiceSettings: {}
        }
      });
    }

    return settings;
  }

  async updateCommunitySettings(communityId: string, updates: any) {
    // Check if community exists
    const community = await ProfileModel.findById(communityId);
    if (!community || community.profileType !== 'community') {
      throw createHttpError(404, 'Community not found');
    }

    // Get existing settings or create new ones
    let settings = await SettingsModel.findOne({ userId: communityId });
    if (!settings) {
      const newSettings = await this.getCommunitySettings(communityId);
      settings = await SettingsModel.findOne({ userId: communityId });
    }

    // Ensure settings is not null
    if (!settings) {
      throw createHttpError(500, 'Failed to get or create settings');
    }

    // Update settings with provided updates
    if (updates.general && settings.general) {
      Object.assign(settings.general, updates.general);
    }
    
    if (updates.notifications && settings.notifications) {
      Object.assign(settings.notifications, updates.notifications);
    }
    
    if (updates.security && settings.security) {
      Object.assign(settings.security, updates.security);
    }
    
    if (updates.privacy && settings.privacy) {
      Object.assign(settings.privacy, updates.privacy);
    }
    
    if (updates.discovery && settings.discovery) {
      Object.assign(settings.discovery, updates.discovery);
    }
    
    if (updates.dataSettings && settings.dataSettings) {
      Object.assign(settings.dataSettings, updates.dataSettings);
    }
    
    if (updates.blockingSettings && settings.blockingSettings) {
      Object.assign(settings.blockingSettings, updates.blockingSettings);
    }
    
    if (updates.pay && settings.pay) {
      Object.assign(settings.pay, updates.pay);
    }

    if (updates.specificSettings) {
      // Ensure specificSettings exists
      if (!settings.specificSettings) {
        settings.specificSettings = new Map();
      }
      
      if (updates.specificSettings instanceof Map) {
        updates.specificSettings.forEach((value: any, key: string) => {
          settings!.specificSettings?.set(key, value);
        });
      } else {
        Object.entries(updates.specificSettings).forEach(([key, value]) => {
          settings!.specificSettings?.set(key, value);
        });
      }
    }

    return await settings.save();
  }

  async setCommunityChatId(communityId: string, chatId: string) {
    const profile = await ProfileModel.findById(communityId);
    if (!profile) throw createHttpError(404, 'Community not found');
    let section = profile.sections.find(s => s.key === 'settings');
    if (!section) {
      section = {
        key: 'settings',
        label: 'Settings',
        order: profile.sections.length,
        fields: []
      };
      profile.sections.push(section);
    }
    let field = section.fields.find((f: any) => f.key === 'chatId');
    if (!field) {
      field = {
        key: 'chatId',
        label: 'Chat ID',
        widget: 'text',
        value: chatId,
        enabled: true
      };
      section.fields.push(field);
    } else {
      field.value = chatId;
    }
    await profile.save();
    return { chatId };
  }

  async addInvitation(communityId: string, { groupId, message }: { groupId: string, message?: string }) {
    const community = await ProfileModel.findById(communityId);
    if (!community) throw createHttpError(404, 'Community not found');
    let section = community.sections.find(s => s.key === 'invitations');
    if (!section) {
      section = {
        key: 'invitations',
        label: 'Invitations',
        order: community.sections.length,
        fields: []
      };
      community.sections.push(section);
    }
    section.fields.push({
      key: `invitation_${Date.now()}`,
      label: 'Invitation',
      widget: 'text',
      value: { groupId, message, invitedAt: new Date() },
      enabled: true
    });
    await community.save();
    // Send notification to the group profile (not user)
    const notificationService = new NotificationService();
    await notificationService.createNotification({
      recipient: groupId,
      type: 'community_group_invitation_request',
      title: 'Community Invitation',
      message: message || 'You have been invited to join a community',
      relatedTo: { model: 'Profile', id: communityId }
    });
    return { invited: true };
  }

  async addDiscussion(communityId: string, { title, content, author }: { title: string, content: string, author: string }) {
    const profile = await ProfileModel.findById(communityId);
    if (!profile) throw createHttpError(404, 'Community not found');
    let section = profile.sections.find(s => s.key === 'discussions');
    if (!section) {
      section = {
        key: 'discussions',
        label: 'Discussions',
        order: profile.sections.length,
        fields: []
      };
      profile.sections.push(section);
    }
    section.fields.push({
      key: `discussion_${Date.now()}`,
      label: title,
      widget: 'textarea',
      value: { title, content, author, createdAt: new Date() },
      enabled: true
    });
    await profile.save();
    return { discussionAdded: true };
  }

  async addAnnouncement(communityId: string, { title, content, author }: { title: string, content: string, author: string }) {
    const profile = await ProfileModel.findById(communityId);
    if (!profile) throw createHttpError(404, 'Community not found');
    let section = profile.sections.find(s => s.key === 'announcements');
    if (!section) {
      section = {
        key: 'announcements',
        label: 'Announcements',
        order: profile.sections.length,
        fields: []
      };
      profile.sections.push(section);
    }
    section.fields.push({
      key: `announcement_${Date.now()}`,
      label: title,
      widget: 'textarea',
      value: { title, content, author, createdAt: new Date() },
      enabled: true
    });
    await profile.save();
    // Broadcast the announcement as a notification to all members
    if (profile.members && profile.members.length > 0) {
      try {
        const notificationService = new NotificationService();
        await Promise.all(
          profile.members.map(memberId =>
          notificationService.createNotification({
            recipient: memberId,
            type: 'community_announcement',
            title,
            message: content,
            relatedTo: { model: 'Profile', id: communityId }
          })
          )
        );
      } catch (error) {
        // 
        console.error('Error sending notification:', error);
      }
    }
    return { announcementAdded: true };
  }

  async addMember(groupId: string, userId: string) {
    // Check if this is a community (not just a group)
    const profile = await ProfileModel.findById(groupId);
    if (!profile) throw createHttpError(404, 'Profile not found');
    
    // If it's a community, check settings
    if (profile.profileType === 'community') {
      const settings = await this.getCommunitySettings(groupId);
      const joinApproval = settings.specificSettings?.get('joinApproval') || 'automatic';
      const communityType = settings.specificSettings?.get('communityType') || 'public';
      const maxMembers = settings.specificSettings?.get('maxMembers') || null;
      const membershipRestrictions = settings.specificSettings?.get('membershipRestrictions') || 'open';
      
      // Check community type restrictions
      if (communityType === 'private') {
        throw createHttpError(403, 'Cannot directly add members to private community. Invitation required.');
      }
      
      // Check membership restrictions
      if (membershipRestrictions === 'invite_only') {
        throw createHttpError(403, 'This community is invite-only');
      }
      
      // Check member limit
      if (maxMembers && profile.members && profile.members.length >= maxMembers) {
        throw createHttpError(403, `Community has reached maximum member limit of ${maxMembers}`);
      }
      
      // Check if approval is required
      if (joinApproval === 'manual') {
        // Could implement approval workflow here
        throw createHttpError(403, 'Membership requires administrator approval');
      }
      
      // Check if user is already a member
      const isAlreadyMember = profile.members?.some((m: any) => m.toString() === userId);
      if (isAlreadyMember) {
        throw createHttpError(409, 'User is already a member of this community');
      }
    }
    
    const updated = await ProfileModel.findByIdAndUpdate(
      groupId,
      { $addToSet: { members: new mongoose.Types.ObjectId(userId) } },
      { new: true }
    );
    if (!updated) throw createHttpError(404, 'Group not found');
    
    // Send notification if it's a community and notifications are enabled
    if (profile.profileType === 'community') {
      const settings = await this.getCommunitySettings(groupId);
      const notificationSettings = settings.notifications;
      if (notificationSettings.general.allNotifications && notificationSettings.channels.push) {
        const notificationService = new NotificationService();
        await notificationService.createNotification({
          recipient: profile.profileInformation.creator,
          type: 'community_new_member',
          title: 'New Community Member',
          message: 'A new member has joined the community.',
          relatedTo: { model: 'Profile', id: groupId },
        });
      }
    }
    
    return updated;
  }

  async addSubGroup(communityId: string, groupId: string) {
    const updated = await ProfileModel.findByIdAndUpdate(
      communityId,
      { $addToSet: { groups: new mongoose.Types.ObjectId(groupId) } },
      { new: true }
    );
    if (!updated) throw createHttpError(404, 'Community not found');
    return updated;
  }

  async addGroup(communityId: string, groupId: string) {
    // Check if community exists and get settings
    const community = await ProfileModel.findById(communityId);
    if (!community || community.profileType !== 'community') {
      throw createHttpError(404, 'Community not found');
    }
    
    const settings = await this.getCommunitySettings(communityId);
    const groupAddPermission = settings.specificSettings?.get('groupAddPermission') || 'admins';
    const maxGroups = settings.specificSettings?.get('maxGroups') || null;
    const groupApproval = settings.specificSettings?.get('groupApproval') || 'automatic';
    const communityType = settings.specificSettings?.get('communityType') || 'public';
    
    // Check if group addition is allowed based on community type
    if (communityType === 'private' && groupApproval === 'manual') {
      throw createHttpError(403, 'Group addition requires approval in private communities');
    }
    
    // Check group limit
    if (maxGroups && community.groups && community.groups.length >= maxGroups) {
      throw createHttpError(403, `Community has reached maximum group limit of ${maxGroups}`);
    }
    
    // Check if group is already added
    const isAlreadyAdded = community.groups?.some((g: any) => g.toString() === groupId);
    if (isAlreadyAdded) {
      throw createHttpError(409, 'Group is already part of this community');
    }
    
    // Verify the group exists
    const groupProfile = await ProfileModel.findById(groupId);
    if (!groupProfile) {
      throw createHttpError(404, 'Group not found');
    }
    
    // Only add an existing groupId to the community's groups array
    const updated = await ProfileModel.findByIdAndUpdate(
      communityId,
      { $addToSet: { groups: new mongoose.Types.ObjectId(groupId) } },
      { new: true }
    );
    if (!updated) throw createHttpError(404, 'Community not found');
    
    // Send notification to community admin if notifications are enabled
    const notificationSettings = settings.notifications;
    if (notificationSettings.general.allNotifications && notificationSettings.channels.push) {
      const notificationService = new NotificationService();
      await notificationService.createNotification({
        recipient: community.profileInformation.creator,
        type: 'community_new_group',
        title: 'New Group Added',
        message: `Group "${groupProfile.profileInformation.title || groupProfile.profileInformation.username}" has been added to the community.`,
        relatedTo: { model: 'Profile', id: communityId },
      });
    }
    
    return {
      ...updated.toObject(),
      addedGroup: {
        id: groupId,
        name: groupProfile.profileInformation.title || groupProfile.profileInformation.username
      },
      communityType,
      groupApproval
    };
  }

  async cancelGroupInvitation(invitationId: string, userId: string) {
    const invitation = await CommunityGroupInvitation.findById(invitationId);
    if (!invitation) throw createHttpError(404, 'Invitation not found');
    if (invitation.status !== 'pending' && invitation.status !== 'cancelled') throw createHttpError(400, 'Only pending or cancelled invitations can be cancelled');
    if (invitation.invitedBy.toString() != userId) throw createHttpError(403, 'Only the inviter can cancel this invitation');
    invitation.status = 'cancelled';
    invitation.respondedAt = new Date();
    await invitation.save();
    // Notify group admin
    const groupProfile = await ProfileModel.findById(invitation.groupId);
    if (groupProfile) {
      try {
        const notificationService = new NotificationService();
        await notificationService.createNotification({
          recipient: groupProfile.profileInformation.creator,
          type: 'community_group_invitation_cancelled',
          title: 'Community Invitation Cancelled',
          message: 'The invitation to join the community has been cancelled.',
          relatedTo: { model: 'CommunityGroupInvitation', id: invitation._id },
        });
      } catch (error) {
        // set the status back to pending
        invitation.status = 'pending';
        await invitation.save();
        console.error('Error sending notification:', error);
      }
    }
    return invitation;
  }

  async exportProfileList(communityId: string, format: string) {
    const community = await ProfileModel.findById(communityId)
      .populate('members', 'profileInformation.username profileInformation.title profileInformation.email')
      .populate('groups', 'profileInformation.username profileInformation.title profileInformation.email');
    if (!community) throw createHttpError(404, 'Community not found');
    // Example: collect all member and group profiles
    const profiles = [
      ...(community.members || []),
      ...(community.groups || [])
    ].map((p: any) => ({
      username: p.profileInformation?.username,
      title: p.profileInformation?.title,
      email: p.profileInformation?.email || '',
      id: p._id?.toString()
    }));
    let fileBuffer: Buffer, fileName: string, mimeType: string;
    switch (format) {
      case 'xlsx': {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Profiles');
        sheet.addRow(['Username', 'Title', 'Email', 'ID']);
        profiles.forEach(p => sheet.addRow([p.username, p.title, p.email, p.id]));
        fileBuffer = await workbook.xlsx.writeBuffer() as Buffer;
        fileName = 'profiles.xlsx';
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        break;
      }
      case 'csv': {
        const csv = stringify(profiles, { header: true, columns: ['username', 'title', 'email', 'id'] });
        fileBuffer = Buffer.from(csv, 'utf-8');
        fileName = 'profiles.csv';
        mimeType = 'text/csv';
        break;
      }
      case 'docx': {
        const doc = new Document({
          sections: [{
            children: [
              new Paragraph({
                children: [new TextRun('Profile List')],
              }),
              ...profiles.map(p => new Paragraph(`${p.username} | ${p.title} | ${p.email} | ${p.id}`)),
            ],
          }],
        });
        fileBuffer = await Packer.toBuffer(doc);
        fileName = 'profiles.docx';
        mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        break;
      }
      case 'pptx': {
        // Placeholder: PPTXGenJS is browser-oriented, so use a placeholder buffer for now
        fileBuffer = Buffer.from('PPTX export not implemented in Node.js', 'utf-8');
        fileName = 'profiles.pptx';
        mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
        break;
      }
      case 'rtf': {
        // Placeholder: rtf.js is not for Node.js, so use a simple RTF string
        const rtfContent = `{
  \\rtf1\\ansi\\deff0
  {\\fonttbl{\\f0 Courier;}}
  \\f0\\fs20 Profile List\\par
  ${profiles.map(p => `${p.username} | ${p.title} | ${p.email} | ${p.id}\\par`).join('\n  ')}
}`;
        fileBuffer = Buffer.from(rtfContent, 'utf-8');
        fileName = 'profiles.rtf';
        mimeType = 'application/rtf';
        break;
      }
      default:
        throw createHttpError(400, 'Unsupported export format');
    }
    return { fileBuffer, fileName, mimeType };
  }

  async exportAllCommunities(format: string) {
    const communities = await ProfileModel.find({ profileType: 'community' })
      .populate('profileInformation.creator', 'fullName email')
      .populate('members', '_id')
      .populate('groups', '_id');
    const rows = communities.map((c: any) => ({
      name: c.profileInformation?.title || c.profileInformation?.username,
      id: c._id?.toString(),
      creator: c.profileInformation?.creator?.fullName || '',
      creatorEmail: c.profileInformation?.creator?.email || '',
      createdAt: c.profileInformation?.createdAt?.toISOString() || '',
      memberCount: c.members?.length || 0,
      groupCount: c.groups?.length || 0
    }));
    let fileBuffer: Buffer, fileName: string, mimeType: string;
    switch (format) {
      case 'xlsx': {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Communities');
        sheet.addRow(['Name', 'ID', 'Creator', 'Creator Email', 'Created At', 'Member Count', 'Group Count']);
        rows.forEach(r => sheet.addRow([r.name, r.id, r.creator, r.creatorEmail, r.createdAt, r.memberCount, r.groupCount]));
        fileBuffer = await workbook.xlsx.writeBuffer() as Buffer;
        fileName = 'communities.xlsx';
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        break;
      }
      case 'csv': {
        const csv = stringify(rows, { header: true, columns: ['name', 'id', 'creator', 'creatorEmail', 'createdAt', 'memberCount', 'groupCount'] });
        fileBuffer = Buffer.from(csv, 'utf-8');
        fileName = 'communities.csv';
        mimeType = 'text/csv';
        break;
      }
      case 'docx': {
        const doc = new Document({
          sections: [{
            children: [
              new Paragraph({
                children: [new TextRun('Community List')],
              }),
              ...rows.map(r => new Paragraph(`${r.name} | ${r.id} | ${r.creator} | ${r.creatorEmail} | ${r.createdAt} | ${r.memberCount} | ${r.groupCount}`)),
            ],
          }],
        });
        fileBuffer = await Packer.toBuffer(doc);
        fileName = 'communities.docx';
        mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        break;
      }
      case 'pptx': {
        fileBuffer = Buffer.from('PPTX export not implemented in Node.js', 'utf-8');
        fileName = 'communities.pptx';
        mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
        break;
      }
      case 'rtf': {
        const rtfContent = `{
  \rtf1\ansi\deff0
  {\fonttbl{\f0 Courier;}}
  \f0\fs20 Community List\par
  ${rows.map(r => `${r.name} | ${r.id} | ${r.creator} | ${r.creatorEmail} | ${r.createdAt} | ${r.memberCount} | ${r.groupCount}\par`).join('\n  ')}
}`;
        fileBuffer = Buffer.from(rtfContent, 'utf-8');
        fileName = 'communities.rtf';
        mimeType = 'application/rtf';
        break;
      }
      default:
        throw createHttpError(400, 'Unsupported export format');
    }
    return { fileBuffer, fileName, mimeType };
  }

  async updateCommunitySpecificSetting(communityId: string, key: string, value: any) {
    const settings = await this.getCommunitySettings(communityId);
    
    if (!settings.specificSettings) {
      settings.specificSettings = new Map();
    }
    
    settings.specificSettings.set(key, value);
    return await settings.save();
  }

  async getCommunitySpecificSetting(communityId: string, key: string): Promise<any> {
    const settings = await this.getCommunitySettings(communityId);
    return settings.specificSettings?.get(key);
  }

  async updateCommunityNotificationSettings(communityId: string, notificationUpdates: any) {
    const settings = await this.getCommunitySettings(communityId);
    
    // Deep merge notification settings
    if (notificationUpdates.channels) {
      Object.assign(settings.notifications.channels, notificationUpdates.channels);
    }
    
    if (notificationUpdates.general) {
      Object.assign(settings.notifications.general, notificationUpdates.general);
    }

    // Update specific notification categories
    const categories = ['Account', 'Profile', 'networking', 'communication', 'calendar', 'paymentMarketing', 'securityPrivacy', 'appUpdates'];
    
    categories.forEach(category => {
      if (notificationUpdates[category] && (settings.notifications as any)[category]) {
        Object.assign((settings.notifications as any)[category], notificationUpdates[category]);
      }
    });

    return await settings.save();
  }

  async updateCommunityPrivacySettings(communityId: string, privacyUpdates: any) {
    const settings = await this.getCommunitySettings(communityId);
    
    if (privacyUpdates.Visibility) {
      // Deep merge visibility settings
      Object.keys(privacyUpdates.Visibility).forEach(section => {
        if ((settings.privacy.Visibility as any)[section]) {
          Object.assign((settings.privacy.Visibility as any)[section], privacyUpdates.Visibility[section]);
        }
      });
    }
    
    if (privacyUpdates.permissions) {
      Object.assign(settings.privacy.permissions, privacyUpdates.permissions);
    }

    return await settings.save();
  }

  async getCommunityModerationSettings(communityId: string) {
    const settings = await this.getCommunitySettings(communityId);
    
    return {
      communityType: settings.specificSettings?.get('communityType') || 'public',
      joinApproval: settings.specificSettings?.get('joinApproval') || 'automatic',
      memberInvitePermission: settings.specificSettings?.get('memberInvitePermission') || 'admins',
      postingPermission: settings.specificSettings?.get('postingPermission') || 'members',
      moderationLevel: settings.specificSettings?.get('moderationLevel') || 'standard',
      autoModeration: settings.specificSettings?.get('autoModeration') || false,
      contentFiltering: settings.specificSettings?.get('contentFiltering') || 'basic',
      reportThreshold: settings.specificSettings?.get('reportThreshold') || 3,
      blockingSettings: settings.blockingSettings
    };
  }

  async updateCommunityModerationSettings(communityId: string, moderationSettings: any) {
    const settings = await this.getCommunitySettings(communityId);
    
    const moderationKeys = [
      'communityType', 'joinApproval', 'memberInvitePermission', 
      'postingPermission', 'moderationLevel', 'autoModeration',
      'contentFiltering', 'reportThreshold'
    ];
    
    moderationKeys.forEach(key => {
      if (moderationSettings[key] !== undefined) {
        settings.specificSettings?.set(key, moderationSettings[key]);
      }
    });
    
    if (moderationSettings.blockingSettings) {
      Object.assign(settings.blockingSettings, moderationSettings.blockingSettings);
    }

    return await settings.save();
  }

  // Add new method to get community profile with settings
  async getCommunityWithSettings(communityId: string) {
    // Check if community exists
    const community = await ProfileModel.findById(communityId);
    if (!community || community.profileType !== 'community') {
      throw createHttpError(404, 'Community not found');
    }

    // Get community settings
    const settings = await this.getCommunitySettings(communityId);

    return {
      profile: community,
      settings: settings
    };
  }

  async removeMember(communityId: string, memberId: string, removedBy?: string) {
    // Check if community exists and get settings
    const community = await ProfileModel.findById(communityId);
    if (!community || community.profileType !== 'community') {
      throw createHttpError(404, 'Community not found');
    }
    
    const settings = await this.getCommunitySettings(communityId);
    const memberRemovalPermission = settings.specificSettings?.get('memberRemovalPermission') || 'admins';
    const removalRestrictions = settings.specificSettings?.get('removalRestrictions') || 'none';
    const communityType = settings.specificSettings?.get('communityType') || 'public';
    
    // Check if member exists in community
    const isMember = community.members?.some((m: any) => m.toString() === memberId);
    if (!isMember) {
      throw createHttpError(404, 'Member not found in this community');
    }
    
    // Check removal restrictions
    if (removalRestrictions === 'creator_only' && removedBy !== community.profileInformation.creator.toString()) {
      throw createHttpError(403, 'Only the community creator can remove members');
    }
    
    // Prevent creator from being removed
    if (memberId === community.profileInformation.creator.toString()) {
      throw createHttpError(403, 'Community creator cannot be removed');
    }
    
    // Check if removal requires approval in private communities
    if (communityType === 'private' && memberRemovalPermission === 'admin_approval') {
      throw createHttpError(403, 'Member removal requires administrator approval in private communities');
    }
    
    // Get member profile for notification
    const memberProfile = await ProfileModel.findById(memberId);
    
    // Remove member from community
    const updated = await ProfileModel.findByIdAndUpdate(
      communityId,
      { $pull: { members: new mongoose.Types.ObjectId(memberId) } },
      { new: true }
    );
    if (!updated) throw createHttpError(404, 'Community not found');
    
    // Send notification to removed member if notifications are enabled
    const notificationSettings = settings.notifications;
    if (notificationSettings.general.allNotifications && notificationSettings.channels.push && memberProfile) {
      const notificationService = new NotificationService();
      await notificationService.createNotification({
        recipient: memberId,
        type: 'community_member_removed',
        title: 'Removed from Community',
        message: `You have been removed from the community "${community.profileInformation.title || community.profileInformation.username}".`,
        relatedTo: { model: 'Profile', id: communityId },
      });
      
      // Notify community admin
      await notificationService.createNotification({
        recipient: community.profileInformation.creator,
        type: 'community_member_removed',
        title: 'Member Removed',
        message: `Member "${memberProfile.profileInformation.title || memberProfile.profileInformation.username}" has been removed from the community.`,
        relatedTo: { model: 'Profile', id: communityId },
      });
    }
    
    return {
      ...updated.toObject(),
      removedMember: {
        id: memberId,
        name: memberProfile?.profileInformation.title || memberProfile?.profileInformation.username
      },
      removedBy,
      communityType,
      removalRestrictions
    };
  }

  async removeGroup(communityId: string, groupId: string, removedBy?: string) {
    // Check if community exists and get settings
    const community = await ProfileModel.findById(communityId);
    if (!community || community.profileType !== 'community') {
      throw createHttpError(404, 'Community not found');
    }
    
    const settings = await this.getCommunitySettings(communityId);
    const groupRemovalPermission = settings.specificSettings?.get('groupRemovalPermission') || 'admins';
    const removalRestrictions = settings.specificSettings?.get('removalRestrictions') || 'none';
    const communityType = settings.specificSettings?.get('communityType') || 'public';
    
    // Check if group exists in community
    const isGroup = community.groups?.some((g: any) => g.toString() === groupId);
    if (!isGroup) {
      throw createHttpError(404, 'Group not found in this community');
    }
    
    // Check removal restrictions
    if (removalRestrictions === 'creator_only' && removedBy !== community.profileInformation.creator.toString()) {
      throw createHttpError(403, 'Only the community creator can remove groups');
    }
    
    // Check if removal requires approval in private communities
    if (communityType === 'private' && groupRemovalPermission === 'admin_approval') {
      throw createHttpError(403, 'Group removal requires administrator approval in private communities');
    }
    
    // Get group profile for notification
    const groupProfile = await ProfileModel.findById(groupId);
    
    // Remove group from community
    const updated = await ProfileModel.findByIdAndUpdate(
      communityId,
      { $pull: { groups: new mongoose.Types.ObjectId(groupId) } },
      { new: true }
    );
    if (!updated) throw createHttpError(404, 'Community not found');
    
    // Send notification to community admin if notifications are enabled
    const notificationSettings = settings.notifications;
    if (notificationSettings.general.allNotifications && notificationSettings.channels.push && groupProfile) {
      const notificationService = new NotificationService();
      await notificationService.createNotification({
        recipient: community.profileInformation.creator,
        type: 'community_group_removed',
        title: 'Group Removed',
        message: `Group "${groupProfile.profileInformation.title || groupProfile.profileInformation.username}" has been removed from the community.`,
        relatedTo: { model: 'Profile', id: communityId },
      });
    }
    
    return {
      ...updated.toObject(),
      removedGroup: {
        id: groupId,
        name: groupProfile?.profileInformation.title || groupProfile?.profileInformation.username
      },
      removedBy,
      communityType,
      removalRestrictions
    };
  }

  async searchCommunities(query: string, searchBy?: string, limit: number = 10, offset: number = 0) {
    const searchCriteria: any = {
      profileType: 'community',
      $or: [
        { 'profileInformation.title': { $regex: query, $options: 'i' } },
        { 'profileInformation.username': { $regex: query, $options: 'i' } },
        { 'profileInformation.description': { $regex: query, $options: 'i' } }
      ]
    };

    if (searchBy) {
      searchCriteria[`profileInformation.${searchBy}`] = { $regex: query, $options: 'i' };
    }

    // Find communities matching search criteria
    const communities = await ProfileModel.find(searchCriteria)
      .limit(limit)
      .skip(offset)
      .lean();

    // Filter communities based on their privacy settings
    const filteredCommunities = [];
    
    for (const community of communities) {
      try {
        const settings = await this.getCommunitySettings(community._id.toString());
        const communityType = settings.specificSettings?.get('communityType') || 'public';
        const searchable = settings.specificSettings?.get('searchable') !== false;
        const discoverable = settings.specificSettings?.get('discoverable') !== false;
        
        // Only include communities that are:
        // 1. Public or unlisted (not private)
        // 2. Searchable (not hidden from search)
        // 3. Discoverable (can be found in listings)
        if ((communityType === 'public' || communityType === 'unlisted') && searchable && discoverable) {
          filteredCommunities.push({
            ...community,
            communityType,
            memberCount: community.members?.length || 0,
            groupCount: community.groups?.length || 0,
            settings: {
              communityType,
              searchable,
              discoverable
            }
          });
        }
      } catch (error) {
        // If settings can't be retrieved, skip this community
        console.warn(`Could not retrieve settings for community ${community._id}:`, error);
        continue;
      }
    }

    return {
      communities: filteredCommunities,
      total: filteredCommunities.length,
      query,
      searchBy,
      limit,
      offset
    };
  }

  async listCommunities(limit: number = 10, offset: number = 0, sortBy: string = 'createdAt', sortOrder: 'asc' | 'desc' = 'desc') {
    const sortOptions: any = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Find all communities
    const communities = await ProfileModel.find({ profileType: 'community' })
      .sort(sortOptions)
      .limit(limit)
      .skip(offset)
      .lean();

    // Filter communities based on their privacy and listing settings
    const filteredCommunities = [];
    
    for (const community of communities) {
      try {
        const settings = await this.getCommunitySettings(community._id.toString());
        const communityType = settings.specificSettings?.get('communityType') || 'public';
        const discoverable = settings.specificSettings?.get('discoverable') !== false;
        const listable = settings.specificSettings?.get('listable') !== false;
        
        // Only include communities that are:
        // 1. Public (not private or unlisted)
        // 2. Discoverable (can be found in listings)
        // 3. Listable (appears in community lists)
        if (communityType === 'public' && discoverable && listable) {
          filteredCommunities.push({
            ...community,
            communityType,
            memberCount: community.members?.length || 0,
            groupCount: community.groups?.length || 0,
            settings: {
              communityType,
              discoverable,
              listable
            }
          });
        }
      } catch (error) {
        // If settings can't be retrieved, skip this community
        console.warn(`Could not retrieve settings for community ${community._id}:`, error);
        continue;
      }
    }

    // Get total count of listable communities
    const totalListable = await this.getTotalListableCommunities();

    return {
      communities: filteredCommunities,
      total: totalListable,
      limit,
      offset,
      sortBy,
      sortOrder
    };
  }

  private async getTotalListableCommunities(): Promise<number> {
    const allCommunities = await ProfileModel.find({ profileType: 'community' }).lean();
    let count = 0;
    
    for (const community of allCommunities) {
      try {
        const settings = await this.getCommunitySettings(community._id.toString());
        const communityType = settings.specificSettings?.get('communityType') || 'public';
        const discoverable = settings.specificSettings?.get('discoverable') !== false;
        const listable = settings.specificSettings?.get('listable') !== false;
        
        if (communityType === 'public' && discoverable && listable) {
          count++;
        }
      } catch (error) {
        // Skip communities with settings errors
        continue;
      }
    }
    
    return count;
  }
} 