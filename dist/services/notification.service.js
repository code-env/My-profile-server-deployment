"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = exports.notificationEvents = void 0;
const Notification_1 = require("../models/Notification");
const User_1 = require("../models/User");
const logger_1 = require("../utils/logger");
const events_1 = require("events");
const mongoose_1 = __importDefault(require("mongoose"));
const email_service_1 = __importDefault(require("./email.service"));
const telegram_service_1 = __importDefault(require("./telegram.service"));
const firebase_service_1 = __importDefault(require("./firebase.service"));
exports.notificationEvents = new events_1.EventEmitter();
class NotificationService {
    constructor() {
        this.io = null;
        // Listen for notification events
        exports.notificationEvents.on('notification:created', this.handleNotificationCreated.bind(this));
    }
    setSocketServer(io) {
        this.io = io;
    }
    async handleNotificationCreated(notification) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        console.log('Entering handleNotificationCreated with notification:', notification);
        try {
            // Log detailed notification information
            logger_1.logger.info(`Processing notification for user ${notification.recipient}`, {
                notificationType: notification.type,
                relatedModel: (_a = notification.relatedTo) === null || _a === void 0 ? void 0 : _a.model,
                relatedId: (_b = notification.relatedTo) === null || _b === void 0 ? void 0 : _b.id,
                title: notification.title
            });
            if (notification.type === 'system_notification' && ((_c = notification.relatedTo) === null || _c === void 0 ? void 0 : _c.model) === 'Transaction') {
                logger_1.logger.info(`Processing transaction notification`, {
                    transactionId: notification.relatedTo.id,
                    metadata: notification.metadata
                });
            }
            // Emit to connected socket if available
            if (this.io) {
                this.io.to(`user:${notification.recipient}`).emit('notification:new', notification);
                logger_1.logger.info(`Emitted notification to socket for user ${notification.recipient}`);
            }
            // Get the user to check notification preferences - explicitly select telegramNotifications
            const user = await User_1.User.findById(notification.recipient).select('+telegramNotifications');
            if (!user) {
                logger_1.logger.warn(`User not found for notification: ${notification.recipient}`);
                return;
            }
            // Log the user's notification preferences for debugging
            logger_1.logger.info(`Retrieved user for notification: ${notification.recipient}`, {
                hasUser: !!user,
                hasTelegramNotifications: !!user.telegramNotifications,
                telegramEnabled: (_d = user.telegramNotifications) === null || _d === void 0 ? void 0 : _d.enabled,
                telegramUsername: (_e = user.telegramNotifications) === null || _e === void 0 ? void 0 : _e.username,
                telegramId: (_f = user.telegramNotifications) === null || _f === void 0 ? void 0 : _f.telegramId
            });
            logger_1.logger.info(`User notification preferences`, {
                userId: user._id,
                pushEnabled: user.notifications.push,
                emailEnabled: user.notifications.email,
                telegramEnabled: (_g = user.telegramNotifications) === null || _g === void 0 ? void 0 : _g.enabled,
                telegramUsername: (_h = user.telegramNotifications) === null || _h === void 0 ? void 0 : _h.username,
                telegramId: (_j = user.telegramNotifications) === null || _j === void 0 ? void 0 : _j.telegramId
            });
            // Send push notification if user has enabled them
            if (user.notifications.push) {
                logger_1.logger.info(`Sending push notification to user ${user._id}`);
                await this.sendPushNotification(notification);
            }
            // Send email notification if user has enabled them
            if (user.notifications.email) {
                logger_1.logger.info(`Sending email notification to user ${user._id}`);
                await this.sendEmailNotification(notification, user);
            }
            // Send Telegram notification if user has enabled them
            if ((_k = user.telegramNotifications) === null || _k === void 0 ? void 0 : _k.enabled) {
                logger_1.logger.info(`Sending Telegram notification to user ${user._id}`, {
                    telegramUsername: user.telegramNotifications.username,
                    telegramId: user.telegramNotifications.telegramId
                });
                await this.sendTelegramNotification(notification, user);
            }
            else {
                logger_1.logger.info(`Telegram notifications not enabled for user ${user._id}`);
            }
        }
        catch (error) {
            console.error('Error in handleNotificationCreated:', error);
            logger_1.logger.error('Error handling notification creation:', error);
        }
    }
    async sendPushNotification(notification) {
        var _a, _b, _c, _d, _e;
        console.log('Entering sendPushNotification with notification:', notification);
        try {
            const user = await User_1.User.findById(notification.recipient);
            if (!user)
                return;
            // Check if push notifications are enabled for this user
            if (!user.notifications.push) {
                logger_1.logger.info(`Push notifications disabled for user ${user._id}`);
                return;
            }
            // Check if the user has any devices with push tokens
            const devicesWithPushTokens = (_a = user.devices) === null || _a === void 0 ? void 0 : _a.filter(device => device.pushToken);
            if (!devicesWithPushTokens || devicesWithPushTokens.length === 0) {
                logger_1.logger.info(`No push-enabled devices found for user ${user._id}`);
                return;
            }
            // Extract push tokens from devices and filter out undefined values
            const pushTokens = devicesWithPushTokens
                .map(device => device.pushToken)
                .filter((token) => token !== undefined && token !== null);
            // If no valid tokens, exit early
            if (pushTokens.length === 0) {
                logger_1.logger.info(`No valid push tokens found for user ${user._id}`);
                return;
            }
            // Check notification type to determine if it should be sent
            let shouldSend = true;
            // Get user's push notification preferences
            const preferences = {
                transactions: true,
                transactionUpdates: true,
                purchaseConfirmations: true,
                saleConfirmations: true,
                security: true
            };
            if (notification.type === 'system_notification' && ((_b = notification.relatedTo) === null || _b === void 0 ? void 0 : _b.model) === 'Transaction') {
                // For transaction notifications, check specific transaction preferences
                const metadata = notification.metadata || {};
                if (metadata.transactionType === 'BUY_MYPTS' && !preferences.purchaseConfirmations) {
                    shouldSend = false;
                }
                else if (metadata.transactionType === 'SELL_MYPTS' && !preferences.saleConfirmations) {
                    shouldSend = false;
                }
                else if (!preferences.transactions) {
                    shouldSend = false;
                }
            }
            else if (notification.type === 'security_alert' && !preferences.security) {
                shouldSend = false;
            }
            if (!shouldSend) {
                logger_1.logger.info(`Push notification type ${notification.type} disabled for user ${user._id}`);
                return;
            }
            // Send notification based on type
            let result;
            if (notification.type === 'system_notification' && ((_c = notification.relatedTo) === null || _c === void 0 ? void 0 : _c.model) === 'Transaction' && notification.metadata) {
                // For transaction notifications, use the transaction template
                result = await firebase_service_1.default.sendTransactionNotification(pushTokens, notification.title, notification.message, {
                    id: notification.relatedTo.id.toString(),
                    type: notification.metadata.transactionType || 'Transaction',
                    amount: notification.metadata.amount || 0,
                    status: notification.metadata.status || 'Unknown'
                });
            }
            else {
                // For other notifications, use the standard template
                // Create data object with proper type definition
                const data = {
                    notificationType: notification.type,
                    notificationId: notification._id ? notification._id.toString() : '',
                    clickAction: ((_d = notification.action) === null || _d === void 0 ? void 0 : _d.url) ? 'OPEN_URL' : 'OPEN_APP',
                    url: ((_e = notification.action) === null || _e === void 0 ? void 0 : _e.url) || '',
                    timestamp: Date.now().toString()
                };
                if (notification.relatedTo) {
                    data.relatedModel = notification.relatedTo.model;
                    data.relatedId = notification.relatedTo.id.toString();
                }
                result = await firebase_service_1.default.sendMulticastPushNotification(pushTokens, notification.title, notification.message, data);
            }
            // Handle invalid tokens
            if (result.invalidTokens.length > 0) {
                logger_1.logger.info(`Found ${result.invalidTokens.length} invalid push tokens for user ${user._id}`);
                // Remove invalid tokens from user's devices
                await User_1.User.updateOne({ _id: user._id }, {
                    $pull: {
                        devices: {
                            pushToken: { $in: result.invalidTokens }
                        }
                    }
                });
            }
            logger_1.logger.info(`Push notification sent to ${result.success} devices for user ${user._id}`);
        }
        catch (error) {
            console.error('Error in sendPushNotification:', error);
            logger_1.logger.error('Error sending push notification:', error);
        }
    }
    async sendEmailNotification(notification, user) {
        var _a, _b, _c;
        console.log('Entering sendEmailNotification with notification:', notification);
        try {
            if (!user.email) {
                logger_1.logger.info(`No email found for user ${user._id}`);
                return;
            }
            // Check if email notifications are enabled for this user
            if (!user.notifications.email) {
                logger_1.logger.info(`Email notifications disabled for user ${user._id}`);
                return;
            }
            // Check notification type to determine email template and content
            let emailSubject = notification.title;
            let emailTemplate = 'notification-email';
            let templateData = {
                title: notification.title,
                message: notification.message,
                actionUrl: ((_a = notification.action) === null || _a === void 0 ? void 0 : _a.url) || '',
                actionText: ((_b = notification.action) === null || _b === void 0 ? void 0 : _b.text) || '',
                appName: 'MyPts',
                year: new Date().getFullYear()
            };
            // For transaction notifications, use specific templates based on transaction type
            if (notification.type === 'system_notification' && ((_c = notification.relatedTo) === null || _c === void 0 ? void 0 : _c.model) === 'Transaction') {
                templateData.transactionId = notification.relatedTo.id;
                templateData.metadata = notification.metadata || {};
                // Add timestamp if not present
                if (!templateData.metadata.timestamp) {
                    templateData.metadata.timestamp = new Date().toISOString();
                }
                // Choose template based on transaction type
                if (templateData.metadata.transactionType === 'BUY_MYPTS') {
                    emailTemplate = 'purchase-confirmation-email';
                    emailSubject = 'Purchase Confirmation - MyPts';
                }
                else if (templateData.metadata.transactionType === 'SELL_MYPTS') {
                    emailTemplate = 'sale-confirmation-email';
                    emailSubject = 'Sale Confirmation - MyPts';
                }
                else {
                    emailTemplate = 'transaction-notification';
                }
            }
            else if (notification.type === 'security_alert') {
                emailTemplate = 'security-alert-email';
                templateData.metadata = notification.metadata || {};
                // Add timestamp if not present
                if (!templateData.metadata.timestamp) {
                    templateData.metadata.timestamp = new Date().toISOString();
                }
            }
            // Load and compile the template
            try {
                const template = await email_service_1.default.loadAndCompileTemplate(emailTemplate);
                const emailContent = template(templateData);
                // Send the email
                await email_service_1.default.sendEmail(user.email, emailSubject, emailContent);
                logger_1.logger.info(`Email notification sent to ${user.email} using template ${emailTemplate}`);
            }
            catch (templateError) {
                // Fallback to a simple email if template fails
                logger_1.logger.error(`Error with email template ${emailTemplate}, falling back to simple email: ${templateError}`);
                await email_service_1.default.sendAdminNotification(user.email, emailSubject, `<p>${notification.message}</p>` +
                    (notification.action ? `<p><a href="${notification.action.url}">${notification.action.text}</a></p>` : ''));
            }
        }
        catch (error) {
            console.error('Error in sendEmailNotification:', error);
            logger_1.logger.error('Error sending email notification:', error);
        }
    }
    async sendTelegramNotification(notification, user) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        console.log('Entering sendTelegramNotification with notification:', notification);
        logger_1.logger.info(`Attempting to send Telegram notification for user ${user._id}`, {
            notificationType: notification.type,
            relatedModel: (_a = notification.relatedTo) === null || _a === void 0 ? void 0 : _a.model,
            relatedId: (_b = notification.relatedTo) === null || _b === void 0 ? void 0 : _b.id,
            userTelegramSettings: user.telegramNotifications || 'Not available'
        });
        try {
            // Double-check if telegramNotifications is available
            if (!user.telegramNotifications) {
                logger_1.logger.error(`Telegram notifications object not available for user ${user._id} - trying to reload user`);
                // Try to reload the user with explicit selection of telegramNotifications
                user = await User_1.User.findById(user._id).select('+telegramNotifications');
                if (!user || !user.telegramNotifications) {
                    logger_1.logger.error(`Failed to reload user ${user._id} with telegramNotifications`);
                    return;
                }
                logger_1.logger.info(`Successfully reloaded user ${user._id} with telegramNotifications`, {
                    telegramEnabled: user.telegramNotifications.enabled,
                    telegramUsername: user.telegramNotifications.username,
                    telegramId: user.telegramNotifications.telegramId
                });
            }
            if (!((_c = user.telegramNotifications) === null || _c === void 0 ? void 0 : _c.enabled)) {
                logger_1.logger.info(`Telegram notifications not enabled for user ${user._id}`);
                return;
            }
            // Check for either username or telegramId
            if (!((_d = user.telegramNotifications) === null || _d === void 0 ? void 0 : _d.username) && !((_e = user.telegramNotifications) === null || _e === void 0 ? void 0 : _e.telegramId)) {
                logger_1.logger.info(`No Telegram username or ID set for user ${user._id}`);
                return;
            }
            // Prefer telegramId if available, otherwise use username
            const telegramId = user.telegramNotifications.telegramId;
            const telegramUsername = user.telegramNotifications.username;
            const telegramRecipient = telegramId || telegramUsername;
            logger_1.logger.info(`User ${user._id} has Telegram notifications enabled with recipient: ${telegramRecipient}`, {
                telegramId,
                telegramUsername,
                telegramEnabled: user.telegramNotifications.enabled,
                telegramPreferences: user.telegramNotifications.preferences
            });
            logger_1.logger.info(`Preparing to send Telegram notification to user ${user._id} via ${telegramId ? 'ID: ' + telegramId : '@' + telegramUsername}`);
            // Check if this notification type is enabled for Telegram
            const preferences = user.telegramNotifications.preferences || {
                transactions: true,
                transactionUpdates: true,
                purchaseConfirmations: true,
                saleConfirmations: true,
                security: true,
                connectionRequests: false,
                messages: false
            };
            logger_1.logger.info(`User ${user._id} Telegram preferences: ${JSON.stringify(preferences)}`);
            // Check notification type to determine if it should be sent
            let shouldSend = true;
            if (notification.type === 'system_notification' && ((_f = notification.relatedTo) === null || _f === void 0 ? void 0 : _f.model) === 'Transaction') {
                // For transaction notifications, check specific transaction preferences
                const metadata = notification.metadata || {};
                logger_1.logger.info(`Transaction notification metadata: ${JSON.stringify(metadata)}`);
                if (metadata.transactionType === 'BUY_MYPTS' && preferences.purchaseConfirmations === false) {
                    logger_1.logger.info(`Purchase confirmations disabled for user ${user._id}`);
                    shouldSend = false;
                }
                else if (metadata.transactionType === 'SELL_MYPTS' && preferences.saleConfirmations === false) {
                    logger_1.logger.info(`Sale confirmations disabled for user ${user._id}`);
                    shouldSend = false;
                }
                else if (preferences.transactions === false) {
                    logger_1.logger.info(`Transaction notifications disabled for user ${user._id}`);
                    shouldSend = false;
                }
                else {
                    // Default to true for transaction notifications
                    logger_1.logger.info(`Transaction notifications enabled for user ${user._id}`);
                    shouldSend = true;
                }
            }
            else if (notification.type === 'security_alert' && preferences.security === false) {
                logger_1.logger.info(`Security alerts disabled for user ${user._id}`);
                shouldSend = false;
            }
            if (!shouldSend) {
                logger_1.logger.info(`Telegram notification type ${notification.type} disabled for user ${user._id}`);
                return;
            }
            logger_1.logger.info(`Proceeding to send Telegram notification to ${telegramId ? 'ID: ' + telegramId : '@' + telegramUsername}`);
            // Send notification based on type
            if (notification.type === 'system_notification' && ((_g = notification.relatedTo) === null || _g === void 0 ? void 0 : _g.model) === 'Transaction' && notification.metadata) {
                // For transaction notifications, use the transaction template
                logger_1.logger.info(`Sending transaction notification via Telegram to ${telegramRecipient}`);
                logger_1.logger.info(`Transaction metadata: ${JSON.stringify(notification.metadata)}`);
                const result = await telegram_service_1.default.sendTransactionNotification(telegramRecipient, notification.title, notification.message, {
                    id: notification.relatedTo.id.toString(),
                    type: notification.metadata.transactionType || 'Transaction',
                    amount: notification.metadata.amount || 0,
                    balance: notification.metadata.balance || 0,
                    status: notification.metadata.status || 'Unknown'
                }, (_h = notification.action) === null || _h === void 0 ? void 0 : _h.url);
                logger_1.logger.info(`Transaction notification result: ${result ? 'Success' : 'Failed'}`);
            }
            else {
                // For other notifications, use the standard template
                logger_1.logger.info(`Sending standard notification via Telegram to ${telegramRecipient}`);
                const result = await telegram_service_1.default.sendNotification(telegramRecipient, notification.title, notification.message, (_j = notification.action) === null || _j === void 0 ? void 0 : _j.url, (_k = notification.action) === null || _k === void 0 ? void 0 : _k.text);
                logger_1.logger.info(`Standard notification result: ${result ? 'Success' : 'Failed'}`);
            }
            logger_1.logger.info(`Telegram notification sent to ${telegramId ? 'ID: ' + telegramId : '@' + telegramUsername}`);
        }
        catch (error) {
            console.error('Error in sendTelegramNotification:', error);
            logger_1.logger.error('Error sending Telegram notification:', error);
        }
    }
    async createNotification(data) {
        console.log('Entering createNotification with data:', data);
        try {
            const notification = await Notification_1.Notification.create(data);
            exports.notificationEvents.emit('notification:created', notification);
            return notification;
        }
        catch (error) {
            console.error('Error in createNotification:', error);
            logger_1.logger.error('Error creating notification:', error);
            throw error;
        }
    }
    async getUserNotifications(userId, query) {
        console.log('Entering getUserNotifications with userId and query:', userId, query);
        try {
            const { isRead, isArchived = false, limit = 10, page = 1 } = query;
            const filter = {
                recipient: userId,
                isArchived,
            };
            if (typeof isRead === 'boolean') {
                filter.isRead = isRead;
            }
            const notifications = await Notification_1.Notification.find(filter)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean();
            const total = await Notification_1.Notification.countDocuments(filter);
            return {
                notifications,
                pagination: {
                    total,
                    pages: Math.ceil(total / limit),
                    page,
                    limit,
                },
            };
        }
        catch (error) {
            console.error('Error in getUserNotifications:', error);
            logger_1.logger.error('Error getting user notifications:', error);
        }
    }
    async markAsRead(notificationId, userId) {
        console.log('Entering markAsRead with notificationId and userId:', notificationId, userId);
        try {
            return Notification_1.Notification.findOneAndUpdate({ _id: notificationId, recipient: userId }, { isRead: true }, { new: true });
        }
        catch (error) {
            console.error('Error in markAsRead:', error);
            logger_1.logger.error('Error marking notification as read:', error);
        }
    }
    async markAllAsRead(userId) {
        console.log('Entering markAllAsRead with userId:', userId);
        try {
            return Notification_1.Notification.updateMany({ recipient: userId, isRead: false }, { isRead: true });
        }
        catch (error) {
            console.error('Error in markAllAsRead:', error);
            logger_1.logger.error('Error marking all notifications as read:', error);
        }
    }
    async archiveNotification(notificationId, userId) {
        console.log('Entering archiveNotification with notificationId and userId:', notificationId, userId);
        try {
            return Notification_1.Notification.findOneAndUpdate({ _id: notificationId, recipient: userId }, { isArchived: true }, { new: true });
        }
        catch (error) {
            console.error('Error in archiveNotification:', error);
            logger_1.logger.error('Error archiving notification:', error);
        }
    }
    async deleteNotification(notificationId, userId) {
        console.log('Entering deleteNotification with notificationId and userId:', notificationId, userId);
        try {
            return Notification_1.Notification.findOneAndDelete({ _id: notificationId, recipient: userId });
        }
        catch (error) {
            console.error('Error in deleteNotification:', error);
            logger_1.logger.error('Error deleting notification:', error);
        }
    }
    // Helper method to create common notification types
    async createProfileViewNotification(profileId, viewerId, profileOwnerId) {
        console.log('Entering createProfileViewNotification with profileId, viewerId, and profileOwnerId:', profileId, viewerId, profileOwnerId);
        try {
            const viewer = await User_1.User.findById(viewerId).select('firstName lastName');
            if (!viewer)
                return;
            return this.createNotification({
                recipient: profileOwnerId,
                type: 'profile_view',
                title: 'New Profile View',
                message: `${viewer.firstName} ${viewer.lastName} viewed your profile`,
                relatedTo: {
                    model: 'Profile',
                    id: profileId,
                },
                priority: 'low',
            });
        }
        catch (error) {
            console.error('Error in createProfileViewNotification:', error);
            logger_1.logger.error('Error creating profile view notification:', error);
        }
    }
    async createConnectionRequestNotification(requesterId, recipientId) {
        console.log('Entering createConnectionRequestNotification with requesterId and recipientId:', requesterId, recipientId);
        try {
            const requester = await User_1.User.findById(requesterId).select('firstName lastName');
            if (!requester)
                return;
            return this.createNotification({
                recipient: recipientId,
                type: 'connection_request',
                title: 'New Connection Request',
                message: `${requester.firstName} ${requester.lastName} wants to connect with you`,
                relatedTo: {
                    model: 'User',
                    id: requesterId,
                },
                action: {
                    text: 'View Request',
                    url: `/connections/requests/${requesterId}`,
                },
                priority: 'medium',
            });
        }
        catch (error) {
            console.error('Error in createConnectionRequestNotification:', error);
            logger_1.logger.error('Error creating connection request notification:', error);
        }
    }
    async createProfileConnectionRequestNotification(requesterProfileId, receiverProfileId, connectionId) {
        console.log('Entering createProfileConnectionRequestNotification with requesterProfileId and receiverProfileId:', requesterProfileId, receiverProfileId);
        try {
            // Get the profiles
            const ProfileModel = mongoose_1.default.model('Profile');
            const requesterProfile = await ProfileModel.findById(requesterProfileId).select('name profileImage owner');
            const receiverProfile = await ProfileModel.findById(receiverProfileId).select('name owner');
            if (!requesterProfile || !receiverProfile)
                return;
            return this.createNotification({
                recipient: receiverProfile.owner,
                type: 'profile_connection_request',
                title: 'New Profile Connection Request',
                message: `${requesterProfile.name} wants to connect with your profile ${receiverProfile.name}`,
                relatedTo: {
                    model: 'ProfileConnection',
                    id: connectionId,
                },
                action: {
                    text: 'View Request',
                    url: `/profiles/${receiverProfileId}/connections/requests`,
                },
                priority: 'medium',
                data: {
                    requesterProfileId,
                    receiverProfileId,
                    connectionId,
                    requesterProfileName: requesterProfile.name,
                    requesterProfileImage: requesterProfile.profileImage
                }
            });
        }
        catch (error) {
            console.error('Error in createProfileConnectionRequestNotification:', error);
            logger_1.logger.error('Error creating profile connection request notification:', error);
        }
    }
    async createProfileConnectionAcceptedNotification(requesterProfileId, receiverProfileId, connectionId) {
        console.log('Entering createProfileConnectionAcceptedNotification with requesterProfileId and receiverProfileId:', requesterProfileId, receiverProfileId);
        try {
            // Get the profiles
            const ProfileModel = mongoose_1.default.model('Profile');
            const requesterProfile = await ProfileModel.findById(requesterProfileId).select('name owner');
            const receiverProfile = await ProfileModel.findById(receiverProfileId).select('name profileImage owner');
            if (!requesterProfile || !receiverProfile)
                return;
            return this.createNotification({
                recipient: requesterProfile.owner,
                type: 'profile_connection_accepted',
                title: 'Profile Connection Accepted',
                message: `${receiverProfile.name} has accepted your connection request`,
                relatedTo: {
                    model: 'ProfileConnection',
                    id: connectionId,
                },
                action: {
                    text: 'View Profile',
                    url: `/profiles/${receiverProfileId}`,
                },
                priority: 'medium',
                data: {
                    requesterProfileId,
                    receiverProfileId,
                    connectionId,
                    receiverProfileName: receiverProfile.name,
                    receiverProfileImage: receiverProfile.profileImage
                }
            });
        }
        catch (error) {
            console.error('Error in createProfileConnectionAcceptedNotification:', error);
            logger_1.logger.error('Error creating profile connection accepted notification:', error);
        }
    }
    async createEndorsementNotification(endorserId, recipientId, skill) {
        console.log('Entering createEndorsementNotification with endorserId, recipientId, and skill:', endorserId, recipientId, skill);
        try {
            const endorser = await User_1.User.findById(endorserId).select('firstName lastName');
            if (!endorser)
                return;
            return this.createNotification({
                recipient: recipientId,
                type: 'endorsement_received',
                title: 'New Skill Endorsement',
                message: `${endorser.firstName} ${endorser.lastName} endorsed you for ${skill}`,
                relatedTo: {
                    model: 'User',
                    id: endorserId,
                },
                priority: 'medium',
            });
        }
        catch (error) {
            console.error('Error in createEndorsementNotification:', error);
            logger_1.logger.error('Error creating endorsement notification:', error);
        }
    }
    /**
     * Get the count of unread notifications for a user
     * @param userId User ID
     * @returns Count of unread notifications
     */
    async getUnreadCount(userId) {
        console.log('Entering getUnreadCount with userId:', userId);
        try {
            const count = await Notification_1.Notification.countDocuments({
                recipient: userId,
                isRead: false,
                isArchived: false
            });
            return count;
        }
        catch (error) {
            console.error('Error in getUnreadCount:', error);
            logger_1.logger.error('Error getting unread notification count:', error);
            return 0;
        }
    }
}
exports.NotificationService = NotificationService;
