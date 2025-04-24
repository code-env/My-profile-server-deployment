import { getSetting } from '../models/admin-settings.model';
import EmailService from './email.service';
import { logger } from '../utils/logger';
import { AdminNotificationModel } from '../models/admin-notification.model';
import { IMyPtsTransaction, TransactionType } from '../interfaces/my-pts.interface';
import mongoose from 'mongoose';

/**
 * Send a transaction notification to the admin hub email
 * @param transaction The transaction to notify about
 */
export const notifyAdminsOfTransaction = async (transaction: IMyPtsTransaction & { _id: mongoose.Types.ObjectId }): Promise<void> => {
  try {
    // Get admin hub email from settings
    const adminHubEmail = await getSetting<string>('adminHubEmail', 'admin@mypts.com');

    // Get notification preferences
    const notificationPreferences = await getSetting<{
      transactions: boolean;
      profileRegistrations: boolean;
      systemAlerts: boolean;
    }>('notificationPreferences', {
      transactions: true,
      profileRegistrations: true,
      systemAlerts: true
    });

    // Check if transaction notifications are enabled
    if (!notificationPreferences.transactions) {
      logger.info('Transaction notifications are disabled');
      return;
    }

    // Fetch profile information
    const profileInfo = await mongoose.model('Profile').findById(transaction.profileId).lean().exec();

    // Determine transaction badge color
    let transactionBadge = '';
    let transactionBadgeText = '';

    // Use if/else instead of switch to avoid TypeScript enum comparison issues
    if (transaction.type === TransactionType.BUY_MYPTS) {
      transactionBadge = 'badge-green';
      transactionBadgeText = 'Purchase';
    } else if (transaction.type === TransactionType.SELL_MYPTS) {
      transactionBadge = 'badge-blue';
      transactionBadgeText = 'Sale';
    } else if (transaction.type === TransactionType.EARN_MYPTS) {
      transactionBadge = 'badge-purple';
      transactionBadgeText = 'Earned';
    } else if (transaction.type === TransactionType.PURCHASE_PRODUCT) {
      transactionBadge = 'badge-red';
      transactionBadgeText = 'Spent';
    } else if (transaction.type === TransactionType.RECEIVE_PRODUCT_PAYMENT) {
      transactionBadge = 'badge-green';
      transactionBadgeText = 'Received';
    } else if (transaction.type === TransactionType.DONATION_SENT) {
      transactionBadge = 'badge-purple';
      transactionBadgeText = 'Donation Sent';
    } else if (transaction.type === TransactionType.DONATION_RECEIVED) {
      transactionBadge = 'badge-green';
      transactionBadgeText = 'Donation Received';
    } else if (transaction.type === TransactionType.ADJUSTMENT) {
      transactionBadge = 'badge-purple';
      transactionBadgeText = 'Adjustment';
    } else {
      // Default case for any other transaction types
      transactionBadge = 'badge-blue';
      transactionBadgeText = 'Transaction';
    }

    // Determine profile badge class
    let profileBadgeClass = 'badge-blue';
    if (profileInfo && typeof profileInfo === 'object' && 'type' in profileInfo &&
        profileInfo.type && typeof profileInfo.type === 'object' && 'category' in profileInfo.type) {
      const category = profileInfo.type.category.toLowerCase();
      switch (category) {
        case 'individual':
          profileBadgeClass = 'badge-blue';
          break;
        case 'functional':
          profileBadgeClass = 'badge-green';
          break;
        case 'group':
          profileBadgeClass = 'badge-purple';
          break;
        default:
          profileBadgeClass = 'badge-blue';
      }
    }

    // Format date
    const formattedDate = new Date(transaction.createdAt).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    // Create email subject
    const emailSubject = `MyPts Transaction: ${transaction.type} - ${Math.abs(transaction.amount)} MyPts`;

    // Extract profile information safely
    const getProfileData = () => {
      if (!profileInfo || Array.isArray(profileInfo)) {
        return null;
      }

      // Safe property access with type checking
      const getProfileProperty = (obj: any, prop: string, defaultValue: any = undefined) => {
        return obj && typeof obj === 'object' && prop in obj ? obj[prop] : defaultValue;
      };

      // Get profile name safely
      const profileName = getProfileProperty(profileInfo, 'name', 'Unknown Profile');

      // Get profile type information safely
      const profileType = getProfileProperty(profileInfo, 'type', {});
      const profileCategory =
        getProfileProperty(profileType, 'category') ||
        getProfileProperty(profileInfo, 'profileCategory', 'Unknown');
      const profileSubtype =
        getProfileProperty(profileType, 'subtype') ||
        getProfileProperty(profileInfo, 'profileType');

      return {
        id: getProfileProperty(profileInfo, '_id', '').toString(),
        name: profileName,
        initial: (profileName || 'U')[0].toUpperCase(),
        email: getProfileProperty(profileInfo, 'email'),
        description: getProfileProperty(profileInfo, 'description'),
        category: profileCategory,
        type: profileSubtype,
        badgeClass: profileBadgeClass,
        claimed: getProfileProperty(profileInfo, 'claimed', false),
        createdAt: getProfileProperty(profileInfo, 'createdAt')
          ? new Date(getProfileProperty(profileInfo, 'createdAt')).toLocaleString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })
          : 'Unknown',
        profileImage: getProfileProperty(profileInfo, 'profileImage')
      };
    };

    // Prepare template data
    const templateData = {
      appName: 'MyPts',
      title: 'New MyPts Transaction',
      subtitle: `${Math.abs(transaction.amount)} MyPts ${transaction.amount > 0 ? 'added to' : 'removed from'} profile`,
      isTransaction: true,
      transactionType: transaction.type,
      transactionBadge,
      transactionBadgeText,
      amount: Math.abs(transaction.amount),
      balance: transaction.balance,
      date: formattedDate,
      transactionId: transaction._id.toString(),
      description: transaction.description,
      metadata: JSON.stringify(transaction.metadata || {}, null, 2),
      year: new Date().getFullYear(),
      actionUrl: `${process.env.ADMIN_URL || 'http://localhost:3000'}/admin/transactions`,
      actionText: 'View All Transactions',
      profile: getProfileData()
    };

    // Load and compile the template
    const template = await EmailService.loadAndCompileTemplate('apple-notification');
    const emailContent = template(templateData);

    // Send email notification
    await EmailService.sendAdminNotification(
      adminHubEmail,
      emailSubject,
      emailContent
    );

    logger.info(`Transaction notification email sent to ${adminHubEmail}`);

    // Create admin notification record
    await createAdminNotification({
      type: 'TRANSACTION',
      title: `New Transaction: ${transaction.type}`,
      message: `${Math.abs(transaction.amount)} MyPts ${transaction.amount > 0 ? 'added to' : 'removed from'} profile ${transaction.profileId}`,
      referenceId: transaction._id.toString(),
      metadata: {
        transactionType: transaction.type,
        amount: transaction.amount,
        profileId: transaction.profileId
      }
    });

    logger.info('Admin notification created for transaction');
  } catch (error) {
    logger.error(`Error notifying admins of transaction: ${error}`);
  }
};

/**
 * Notify admins of a new profile registration
 * @param profile The newly registered profile
 */
export const notifyAdminsOfProfileRegistration = async (profile: {
  _id: mongoose.Types.ObjectId;
  name: string;
  email?: string;
  createdAt: Date;
  type?: { category?: string; subtype?: string };
  profileCategory?: string;
  profileType?: string;
  description?: string;
  claimed?: boolean;
  profileImage?: string;
}): Promise<void> => {
  try {
    // Get admin hub email from settings
    const adminHubEmail = await getSetting<string>('adminHubEmail', 'admin@mypts.com');

    // Get notification preferences
    const notificationPreferences = await getSetting<{
      transactions: boolean;
      profileRegistrations: boolean;
      systemAlerts: boolean;
    }>('notificationPreferences', {
      transactions: true,
      profileRegistrations: true,
      systemAlerts: true
    });

    // Check if profile registration notifications are enabled
    if (!notificationPreferences.profileRegistrations) {
      logger.info('Profile registration notifications are disabled');
      return;
    }

    // Determine profile badge class
    let profileBadgeClass = 'badge-blue';
    if (profile.type?.category) {
      const category = profile.type.category.toLowerCase();
      switch (category) {
        case 'individual':
          profileBadgeClass = 'badge-blue';
          break;
        case 'functional':
          profileBadgeClass = 'badge-green';
          break;
        case 'group':
          profileBadgeClass = 'badge-purple';
          break;
        default:
          profileBadgeClass = 'badge-blue';
      }
    } else if (profile.profileCategory) {
      const category = profile.profileCategory.toLowerCase();
      switch (category) {
        case 'individual':
          profileBadgeClass = 'badge-blue';
          break;
        case 'functional':
          profileBadgeClass = 'badge-green';
          break;
        case 'group':
          profileBadgeClass = 'badge-purple';
          break;
        default:
          profileBadgeClass = 'badge-blue';
      }
    }

    // Format date
    const formattedDate = new Date(profile.createdAt).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Create email subject
    const emailSubject = `New Profile Registration: ${profile.name}`;

    // Prepare profile data
    const profileData = {
      id: profile._id.toString(),
      name: profile.name,
      initial: (profile.name || 'U')[0].toUpperCase(),
      email: profile.email,
      description: profile.description,
      category: profile.type?.category || profile.profileCategory || 'Unknown',
      type: profile.type?.subtype || profile.profileType,
      badgeClass: profileBadgeClass,
      claimed: profile.claimed || false,
      createdAt: formattedDate,
      profileImage: profile.profileImage
    };

    // Prepare template data
    const templateData = {
      appName: 'MyPts',
      title: 'New Profile Registration',
      subtitle: 'A new profile has been registered in the system',
      isTransaction: false,
      date: formattedDate,
      description: 'A new profile has been registered in the MyPts system. Details are provided below.',
      year: new Date().getFullYear(),
      actionUrl: `${process.env.ADMIN_URL || 'http://localhost:3000'}/admin/profiles`,
      actionText: 'View All Profiles',
      profile: profileData
    };

    // Load and compile the template
    const template = await EmailService.loadAndCompileTemplate('apple-notification');
    const emailContent = template(templateData);

    // Send email notification
    await EmailService.sendAdminNotification(
      adminHubEmail,
      emailSubject,
      emailContent
    );

    logger.info(`Profile registration notification email sent to ${adminHubEmail}`);

    // Create admin notification record
    await createAdminNotification({
      type: 'PROFILE_REGISTRATION',
      title: 'New Profile Registration',
      message: `New profile registered: ${profile.name}`,
      referenceId: profile._id.toString(),
      metadata: {
        name: profile.name,
        email: profile.email,
        profileType: profile.type?.category || profile.profileCategory,
        profileSubtype: profile.type?.subtype || profile.profileType
      }
    });

    logger.info('Admin notification created for profile registration');
  } catch (error) {
    logger.error(`Error notifying admins of profile registration: ${error}`);
  }
};

/**
 * Create an admin notification
 */
export const createAdminNotification = async (notification: {
  type: string;
  title: string;
  message: string;
  referenceId?: string;
  metadata?: any;
}): Promise<void> => {
  try {
    await AdminNotificationModel.create({
      type: notification.type,
      title: notification.title,
      message: notification.message,
      referenceId: notification.referenceId,
      metadata: notification.metadata,
      isRead: false,
      createdAt: new Date()
    });
  } catch (error) {
    logger.error(`Error creating admin notification: ${error}`);
  }
};
