import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import EmailService from '../services/email.service';
import telegramService from '../services/telegram.service';
import firebaseService from '../services/firebase.service';
import { User } from '../models/User';
import axios from 'axios';
import { config } from '../config/config';
// Helper function to check if user is admin
const isAdmin = (req: Request): boolean => {
  const user: any = req.user;
  return user && user.role === 'admin';
};

// Create a notification service instance
const notificationService = new (require('../services/notification.service').NotificationService)();

// Custom async handler that doesn't have the return type issue
const customAsyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * @desc    Test email notification
 * @route   POST /api/test/notifications/email
 * @access  Admin
 */
export const testEmailNotification = customAsyncHandler(async (req: Request, res: Response) => {
  // Check if user is admin
  if (!isAdmin(req)) {
    return res.status(403).json({
      success: false,
      message: 'Unauthorized: Admin access required'
    });
  }

  const { email, subject, message, template } = req.body;

  if (!email || !subject || !message) {
    return res.status(400).json({
      success: false,
      message: 'Email, subject, and message are required'
    });
  }

  try {
    // Use template if provided, otherwise use simple email
    if (template) {
      const compiledTemplate = await EmailService.loadAndCompileTemplate(template);
      const templateData = {
        title: subject,
        message,
        actionUrl: req.body.actionUrl || '',
        actionText: req.body.actionText || 'View Details',
        appName: config.APP_NAME,
        year: new Date().getFullYear(),
        metadata: req.body.metadata || {}
      };

      const emailContent = compiledTemplate(templateData);
      await EmailService.sendEmail(email, subject, emailContent);
    } else {
      await EmailService.sendAdminNotification(email, subject, `<p>${message}</p>`);
    }

    res.json({
      success: true,
      message: 'Test email notification sent'
    });
  } catch (error) {
    logger.error('Error sending test email notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test email notification',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @desc    Test push notification
 * @route   POST /api/test/notifications/push
 * @access  Admin
 */
export const testPushNotification = customAsyncHandler(async (req: Request, res: Response) => {
  // Check if user is admin
  if (!isAdmin(req)) {
    return res.status(403).json({
      success: false,
      message: 'Unauthorized: Admin access required'
    });
  }

  const { title, message, token, userId } = req.body;

  if ((!token && !userId) || !title || !message) {
    return res.status(400).json({
      success: false,
      message: 'Either token or userId is required, along with title and message'
    });
  }

  try {
    let tokens: string[] = [];

    // If token is provided, use it directly
    if (token) {
      tokens = [token];
    }
    // If userId is provided, get tokens from user's devices
    else if (userId) {
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const devicesWithPushTokens = user.devices?.filter(device => device.pushToken);
      if (!devicesWithPushTokens || devicesWithPushTokens.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No push-enabled devices found for this user'
        });
      }

      tokens = devicesWithPushTokens
        .map(device => device.pushToken)
        .filter((token): token is string => token !== undefined && token !== null);
    }

    if (tokens.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid push tokens found'
      });
    }

    // Send push notification
    const data = {
      notificationType: 'test',
      clickAction: req.body.actionUrl ? 'OPEN_URL' : 'OPEN_APP',
      url: req.body.actionUrl || '',
      timestamp: Date.now().toString()
    };

    const result = await firebaseService.sendMulticastPushNotification(
      tokens,
      title,
      message,
      data
    );

    res.json({
      success: true,
      message: 'Test push notification sent',
      result: {
        success: result.success,
        failure: result.failure,
        invalidTokens: result.invalidTokens
      }
    });
  } catch (error) {
    logger.error('Error sending test push notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test push notification',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @desc    Test Telegram notification
 * @route   POST /api/test/notifications/telegram
 * @access  Admin
 */
export const testTelegramNotification = customAsyncHandler(async (req: Request, res: Response) => {
  // Check if user is admin
  if (!isAdmin(req)) {
    return res.status(403).json({
      success: false,
      message: 'Unauthorized: Admin access required'
    });
  }

  const { username, message, title } = req.body;

  if (!username || !message) {
    return res.status(400).json({
      success: false,
      message: 'Username and message are required'
    });
  }

  try {
    // Send Telegram notification
    const result = await telegramService.sendNotification(
      username,
      title || 'Test Notification',
      message,
      req.body.actionUrl,
      req.body.actionText
    );

    if (result) {
      res.json({
        success: true,
        message: 'Test Telegram notification sent'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send test Telegram notification'
      });
    }
  } catch (error) {
    logger.error('Error sending test Telegram notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test Telegram notification',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @desc    Test system notification (creates a notification in the database)
 * @route   POST /api/test/notifications/system
 * @access  Admin
 */
export const verifyTelegramSetup = customAsyncHandler(async (req: Request, res: Response) => {
  // Check if user is admin
  if (!isAdmin(req)) {
    res.status(403).json({
      success: false,
      message: 'Unauthorized: Admin access required'
    });
    return;
  }

  try {
    // Get the bot token from environment
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!botToken) {
      res.status(500).json({
        success: false,
        message: 'TELEGRAM_BOT_TOKEN not set in environment variables'
      });
      return;
    }

    // Log the token (first 10 chars only for security)
    logger.info(`Using Telegram bot token: ${botToken.substring(0, 10)}...`);

    // Verify the bot token by calling the Telegram API directly
    try {
      const apiUrl = `https://api.telegram.org/bot${botToken}/getMe`;
      logger.info(`Calling Telegram API: ${apiUrl}`);

      const response = await axios.get(apiUrl);

      logger.info(`Telegram API response: ${JSON.stringify(response.data)}`);

      if (response.data && response.data.ok) {
        const botInfo = response.data.result;
        res.json({
          success: true,
          message: 'Telegram bot is properly configured',
          botInfo: {
            id: botInfo.id,
            username: botInfo.username,
            firstName: botInfo.first_name,
            canJoinGroups: botInfo.can_join_groups,
            canReadAllGroupMessages: botInfo.can_read_all_group_messages,
            supportsInlineQueries: botInfo.supports_inline_queries
          }
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Invalid Telegram bot token',
          response: response.data
        });
      }
    } catch (apiError: any) {
      logger.error('Error calling Telegram API:', apiError);
      res.status(500).json({
        success: false,
        message: 'Error calling Telegram API',
        error: apiError.message,
        response: apiError.response?.data
      });
    }
  } catch (error: any) {
    logger.error('Error verifying Telegram setup:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying Telegram setup',
      error: error.message
    });
  }
});

export const testSystemNotification = customAsyncHandler(async (req: Request, res: Response) => {
  // Check if user is admin
  if (!isAdmin(req)) {
    return res.status(403).json({
      success: false,
      message: 'Unauthorized: Admin access required'
    });
  }

  const { userId, title, message, type } = req.body;

  if (!userId || !title || !message) {
    return res.status(400).json({
      success: false,
      message: 'UserId, title, and message are required'
    });
  }

  try {
    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Create notification
    const notification = await notificationService.createNotification({
      recipient: userId,
      title,
      message,
      type: type || 'system_notification',
      action: req.body.action,
      relatedTo: req.body.relatedTo,
      metadata: req.body.metadata
    });

    res.json({
      success: true,
      message: 'Test system notification created',
      notification
    });
  } catch (error) {
    logger.error('Error creating test system notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create test system notification',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
