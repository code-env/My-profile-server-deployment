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
        var _a;
        console.log('Entering handleNotificationCreated with notification:', notification);
        try {
            // Emit to connected socket if available
            if (this.io) {
                this.io.to(`user:${notification.recipient}`).emit('notification:new', notification);
            }
            // Get the user to check notification preferences
            const user = await User_1.User.findById(notification.recipient);
            if (!user)
                return;
            // Send push notification if user has enabled them
            if (user.notifications.push) {
                await this.sendPushNotification(notification);
            }
            // Send email notification if user has enabled them
            if (user.notifications.email) {
                await this.sendEmailNotification(notification, user);
            }
            // Send Telegram notification if user has enabled them
            if ((_a = user.telegramNotifications) === null || _a === void 0 ? void 0 : _a.enabled) {
                await this.sendTelegramNotification(notification, user);
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
        var _a, _b, _c, _d, _e, _f, _g;
        console.log('Entering sendTelegramNotification with notification:', notification);
        try {
            if (!((_a = user.telegramNotifications) === null || _a === void 0 ? void 0 : _a.enabled) || !((_b = user.telegramNotifications) === null || _b === void 0 ? void 0 : _b.username)) {
                logger_1.logger.info(`Telegram notifications not enabled or no username for user ${user._id}`);
                return;
            }
            const telegramUsername = user.telegramNotifications.username;
            // Check if this notification type is enabled for Telegram
            const preferences = user.telegramNotifications.preferences || {};
            // Check notification type to determine if it should be sent
            let shouldSend = true;
            if (notification.type === 'system_notification' && ((_c = notification.relatedTo) === null || _c === void 0 ? void 0 : _c.model) === 'Transaction') {
                // For transaction notifications, check specific transaction preferences
                const metadata = notification.metadata || {};
                if (metadata.transactionType === 'BUY_MYPTS' && preferences.purchaseConfirmations === false) {
                    shouldSend = false;
                }
                else if (metadata.transactionType === 'SELL_MYPTS' && preferences.saleConfirmations === false) {
                    shouldSend = false;
                }
                else if (preferences.transactions === false) {
                    shouldSend = false;
                }
            }
            else if (notification.type === 'security_alert' && preferences.security === false) {
                shouldSend = false;
            }
            if (!shouldSend) {
                logger_1.logger.info(`Telegram notification type ${notification.type} disabled for user ${user._id}`);
                return;
            }
            // Send notification based on type
            if (notification.type === 'system_notification' && ((_d = notification.relatedTo) === null || _d === void 0 ? void 0 : _d.model) === 'Transaction' && notification.metadata) {
                // For transaction notifications, use the transaction template
                await telegram_service_1.default.sendTransactionNotification(telegramUsername, notification.title, notification.message, {
                    id: notification.relatedTo.id.toString(),
                    type: notification.metadata.transactionType || 'Transaction',
                    amount: notification.metadata.amount || 0,
                    balance: notification.metadata.balance || 0,
                    status: notification.metadata.status || 'Unknown'
                }, (_e = notification.action) === null || _e === void 0 ? void 0 : _e.url);
            }
            else {
                // For other notifications, use the standard template
                await telegram_service_1.default.sendNotification(telegramUsername, notification.title, notification.message, (_f = notification.action) === null || _f === void 0 ? void 0 : _f.url, (_g = notification.action) === null || _g === void 0 ? void 0 : _g.text);
            }
            logger_1.logger.info(`Telegram notification sent to @${telegramUsername}`);
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
