import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import createHttpError from 'http-errors';
import { User } from '../models/User';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';
import telegramService from '../services/telegram.service';

/**
 * @desc    Get user notification preferences
 * @route   GET /api/user/notification-preferences
 * @access  Private
 */
export const getUserNotificationPreferences = asyncHandler(async (req: Request, res: Response) => {
  const user: any = req.user!;

  try {
    const userDoc = await User.findById(user._id).select('notifications');

    if (!userDoc) {
      throw createHttpError(404, 'User not found');
    }

    // Get the current notification preferences
    const currentPreferences = userDoc.notifications || {
      email: true,
      push: true,
      sms: false,
      marketing: false
    };

    // Get Telegram preferences if they exist
    const telegramPrefs = userDoc.telegramNotifications || {
      enabled: false,
      username: '',
      preferences: {
        transactions: true,
        transactionUpdates: true,
        purchaseConfirmations: true,
        saleConfirmations: true,
        security: true,
        connectionRequests: false,
        messages: false
      }
    };

    // Create a more detailed preferences object based on the basic preferences
    const detailedPreferences = {
      email: {
        transactions: currentPreferences.email,
        transactionUpdates: currentPreferences.email,
        purchaseConfirmations: currentPreferences.email,
        saleConfirmations: currentPreferences.email,
        security: currentPreferences.email,
        marketing: currentPreferences.marketing,
        profileViews: currentPreferences.email,
        connectionRequests: currentPreferences.email,
        messages: currentPreferences.email,
        endorsements: currentPreferences.email,
        accountUpdates: currentPreferences.email
      },
      push: {
        transactions: currentPreferences.push,
        transactionUpdates: currentPreferences.push,
        purchaseConfirmations: currentPreferences.push,
        saleConfirmations: currentPreferences.push,
        security: currentPreferences.push,
        profileViews: currentPreferences.push,
        connectionRequests: currentPreferences.push,
        messages: currentPreferences.push,
        endorsements: currentPreferences.push,
        accountUpdates: currentPreferences.push
      },
      telegram: {
        enabled: telegramPrefs.enabled,
        username: telegramPrefs.username,
        transactions: telegramPrefs.preferences?.transactions || true,
        transactionUpdates: telegramPrefs.preferences?.transactionUpdates || true,
        purchaseConfirmations: telegramPrefs.preferences?.purchaseConfirmations || true,
        saleConfirmations: telegramPrefs.preferences?.saleConfirmations || true,
        security: telegramPrefs.preferences?.security || true,
        connectionRequests: telegramPrefs.preferences?.connectionRequests || false,
        messages: telegramPrefs.preferences?.messages || false
      }
    };

    res.json({
      success: true,
      data: detailedPreferences
    });
  } catch (error) {
    logger.error('Error getting user notification preferences:', error);
    throw error;
  }
});

/**
 * @desc    Verify Telegram connection by sending a test message
 * @route   POST /api/user/notification-preferences/verify-telegram
 * @access  Private
 */
export const verifyTelegramConnection = asyncHandler(async (req: Request, res: Response) => {
  const user: any = req.user!;
  const { username, telegramId } = req.body;

  if (!username && !telegramId) {
    res.status(400).json({
      success: false,
      message: 'Either Telegram username or Telegram ID is required'
    });
    return;
  }

  try {
    logger.info(`Verifying Telegram connection for user ${user._id} with username @${username}`);

    // Clean up username (remove @ if present)
    const cleanUsername = username.startsWith('@') ? username.substring(1) : username;

    // First check if the username is valid
    const usernameCheck = await telegramService.checkUsername(cleanUsername);

    if (!usernameCheck.valid) {
      logger.warn(`Invalid Telegram username @${cleanUsername}: ${usernameCheck.reason}`);

      // Provide a helpful error message based on the reason
      let errorMessage = 'Failed to verify your Telegram username.';

      if (usernameCheck.reason === 'Username not found') {
        errorMessage = 'The Telegram username was not found. Please check that you entered your username correctly.';
      } else if (usernameCheck.reason?.includes('Invalid username format')) {
        errorMessage = usernameCheck.reason;
      } else {
        errorMessage = `Verification failed: ${usernameCheck.reason || 'Unknown error'}`;
      }

      res.status(400).json({
        success: false,
        message: errorMessage,
        username: cleanUsername,
        reason: usernameCheck.reason
      });
      return;
    }

    // Username is valid, now try to send a message
    logger.info(`Username @${cleanUsername} is valid, sending verification message`);

    // Send a verification message
    const verificationMessage = `*Verification Message from MyPts* ✅\n\n` +
      `Hello! This is a verification message to confirm your Telegram connection with MyPts.\n\n` +
      `If you received this message, your Telegram notifications are working correctly.\n\n` +
      `You can manage your notification preferences in your MyPts account settings.`;

    const result = await telegramService.sendMessage(cleanUsername, verificationMessage);

    logger.info(`Telegram verification message sent to @${cleanUsername}: ${result ? 'SUCCESS' : 'FAILED'}`);

    if (result) {
      res.json({
        success: true,
        message: 'Verification message sent to your Telegram account',
        username: cleanUsername
      });
    } else {
      // If username is valid but message sending failed, it's likely because the user hasn't started a chat with the bot
      res.status(400).json({
        success: false,
        message: 'Your Telegram username is valid, but we couldn\'t send you a message. Please make sure you have started a chat with @MyPtsBot on Telegram.',
        username: cleanUsername,
        reason: 'bot_chat_not_started'
      });
    }
  } catch (error) {
    logger.error(`Error verifying Telegram connection for user ${user._id}:`, error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while verifying your Telegram connection',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export const updateUserNotificationPreferences = asyncHandler(async (req: Request, res: Response) => {
  const user: any = req.user!;
  const preferences = req.body;

  try {
    // Validate the preferences
    if (!preferences || typeof preferences !== 'object') {
      throw createHttpError(400, 'Invalid preferences format');
    }

    // Convert detailed preferences to the basic model structure
    const basicPreferences = {
      email: preferences.email?.transactions || false,
      push: preferences.push?.transactions || false,
      sms: false, // Not implemented in the frontend yet
      marketing: preferences.email?.marketing || false
    };

    // Save telegram preferences in a separate field if provided
    let telegramPreferences = null;
    let shouldSendVerification = false;
    let telegramUsername = '';

    // Get current user to check existing Telegram settings
    const currentUser = await User.findById(user._id).select('telegramNotifications');
    const currentTelegramEnabled = currentUser?.telegramNotifications?.enabled || false;
    const currentTelegramUsername = currentUser?.telegramNotifications?.username || '';

    // Handle Telegram preferences
    if (preferences.telegram !== undefined) {
      logger.info(`Processing Telegram preferences for user ${user._id}`, {
        telegramPrefs: preferences.telegram
      });

      const newTelegramUsername = preferences.telegram.username || '';
      const isEnabled = preferences.telegram.enabled === true;

      // If Telegram is enabled
      if (isEnabled) {
        // Send verification if Telegram is newly enabled or username changed
        shouldSendVerification =
          (isEnabled && !currentTelegramEnabled) ||
          (newTelegramUsername && newTelegramUsername !== currentTelegramUsername);

        telegramUsername = newTelegramUsername;

        // Make sure we use true values for preferences if not explicitly set to false
        // Get existing telegramId if available
        const existingTelegramId = currentUser?.telegramNotifications?.telegramId;

        telegramPreferences = {
          enabled: true,
          username: newTelegramUsername,
          // Only include telegramId if it already exists
          ...(existingTelegramId ? { telegramId: existingTelegramId } : {}),
          preferences: {
            transactions: preferences.telegram.transactions !== false,
            transactionUpdates: preferences.telegram.transactionUpdates !== false,
            purchaseConfirmations: preferences.telegram.purchaseConfirmations !== false,
            saleConfirmations: preferences.telegram.saleConfirmations !== false,
            security: preferences.telegram.security !== false,
            connectionRequests: preferences.telegram.connectionRequests === true,
            messages: preferences.telegram.messages === true
          }
        };

        logger.info(`Enabling Telegram notifications for user ${user._id}`, {
          username: newTelegramUsername,
          telegramId: existingTelegramId || 'Not set',
          preferences: telegramPreferences.preferences
        });
      } else {
        // If Telegram is disabled, explicitly set enabled to false but keep other settings
        telegramPreferences = {
          enabled: false,
          username: currentTelegramUsername,
          // Only include telegramId if it already exists
          ...(currentUser?.telegramNotifications?.telegramId ? { telegramId: currentUser.telegramNotifications.telegramId } : {}),
          preferences: currentUser?.telegramNotifications?.preferences || {
            transactions: true,
            transactionUpdates: true,
            purchaseConfirmations: true,
            saleConfirmations: true,
            security: true,
            connectionRequests: false,
            messages: false
          }
        };

        logger.info(`Disabling Telegram notifications for user ${user._id}`);
      }
    } else {
      logger.info(`No Telegram preferences provided for user ${user._id}`);
    }

    // Send verification message if needed
    let telegramVerificationSent = false;
    if (shouldSendVerification && telegramUsername) {
      logger.info(`Sending Telegram verification message to @${telegramUsername}`);

      try {
        // Send a verification message
        const verificationMessage = `*Verification Message from MyPts* ✅\n\n` +
          `Hello! This is a verification message to confirm your Telegram connection with MyPts.\n\n` +
          `If you received this message, your Telegram notifications are working correctly.\n\n` +
          `You can manage your notification preferences in your MyPts account settings.`;

        telegramVerificationSent = await telegramService.sendMessage(telegramUsername, verificationMessage);

        logger.info(`Telegram verification message sent to @${telegramUsername}: ${telegramVerificationSent ? 'SUCCESS' : 'FAILED'}`);
      } catch (error) {
        logger.error(`Error sending Telegram verification message to @${telegramUsername}:`, error);
      }
    }

    // Log the preferences being saved
    logger.info(`Updating notification preferences for user ${user._id}`, {
      basicPreferences,
      telegramPreferences
    });

    // Update the user's notification preferences
    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      {
        $set: {
          notifications: basicPreferences,
          // Always set telegramNotifications, even if it's just to update enabled status
          'telegramNotifications': telegramPreferences || {
            enabled: false,
            username: '',
            // Don't include telegramId in default preferences
            preferences: {
              transactions: true,
              transactionUpdates: true,
              purchaseConfirmations: true,
              saleConfirmations: true,
              security: true,
              connectionRequests: false,
              messages: false
            }
          }
        }
      },
      { new: true }
    ).select('notifications telegramNotifications');

    // Log the updated user
    logger.info(`Updated user notification preferences`, {
      userId: user._id,
      telegramEnabled: updatedUser?.telegramNotifications?.enabled,
      telegramUsername: updatedUser?.telegramNotifications?.username
    });

    if (!updatedUser) {
      throw createHttpError(404, 'User not found');
    }

    // Get the updated Telegram preferences
    const updatedTelegramPrefs = updatedUser.telegramNotifications || {
      enabled: false,
      username: '',
      preferences: {
        transactions: true,
        transactionUpdates: true,
        purchaseConfirmations: true,
        saleConfirmations: true,
        security: true,
        connectionRequests: false,
        messages: false
      }
    };

    res.json({
      success: true,
      message: 'Notification preferences updated successfully',
      telegramVerification: shouldSendVerification ? {
        sent: telegramVerificationSent,
        username: telegramUsername
      } : null,
      data: {
        email: {
          transactions: updatedUser.notifications.email,
          transactionUpdates: updatedUser.notifications.email,
          purchaseConfirmations: updatedUser.notifications.email,
          saleConfirmations: updatedUser.notifications.email,
          security: updatedUser.notifications.email,
          marketing: updatedUser.notifications.marketing,
          profileViews: updatedUser.notifications.email,
          connectionRequests: updatedUser.notifications.email,
          messages: updatedUser.notifications.email,
          endorsements: updatedUser.notifications.email,
          accountUpdates: updatedUser.notifications.email
        },
        push: {
          transactions: updatedUser.notifications.push,
          transactionUpdates: updatedUser.notifications.push,
          purchaseConfirmations: updatedUser.notifications.push,
          saleConfirmations: updatedUser.notifications.push,
          security: updatedUser.notifications.push,
          profileViews: updatedUser.notifications.push,
          connectionRequests: updatedUser.notifications.push,
          messages: updatedUser.notifications.push,
          endorsements: updatedUser.notifications.push,
          accountUpdates: updatedUser.notifications.push
        },
        telegram: {
          enabled: updatedTelegramPrefs.enabled,
          username: updatedTelegramPrefs.username,
          transactions: updatedTelegramPrefs.preferences?.transactions || true,
          transactionUpdates: updatedTelegramPrefs.preferences?.transactionUpdates || true,
          purchaseConfirmations: updatedTelegramPrefs.preferences?.purchaseConfirmations || true,
          saleConfirmations: updatedTelegramPrefs.preferences?.saleConfirmations || true,
          security: updatedTelegramPrefs.preferences?.security || true,
          connectionRequests: updatedTelegramPrefs.preferences?.connectionRequests || false,
          messages: updatedTelegramPrefs.preferences?.messages || false
        }
      }
    });
  } catch (error) {
    logger.error('Error updating user notification preferences:', error);
    throw error;
  }
});
