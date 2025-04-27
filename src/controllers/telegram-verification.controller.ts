import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import axios from 'axios';

// Custom async handler that doesn't have the return type issue
const customAsyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * @desc    Verify Telegram connection by sending a test message using both ID and username
 * @route   POST /api/user/notification-preferences/verify-telegram
 * @access  Private
 */
export const verifyTelegramConnection = customAsyncHandler(async (req: Request, res: Response) => {
  const user: any = req.user!;
  const { username } = req.body;
  const telegramId = '8017650902'; // Hard-coded ID for testing

  if (!username) {
    return res.status(400).json({
      success: false,
      message: 'Telegram username is required'
    });
  }

  try {
    // Clean up username (remove @ if present)
    const cleanUsername = username.startsWith('@') ? username.substring(1) : username;

    logger.info(`Verifying Telegram connection for user ${user._id} with username @${cleanUsername} and ID ${telegramId}`);

    // Basic validation
    const usernameRegex = /^[a-zA-Z0-9_]{5,32}$/;
    if (!usernameRegex.test(cleanUsername)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid username format. Telegram usernames must be 5-32 characters and can only contain letters, numbers, and underscores.',
        reason: 'invalid_format'
      });
    }

    // Create verification message
    const verificationMessage = `*Verification Message from MyPts* ✅\n\n` +
      `Hello! This is a verification message to confirm your Telegram connection with MyPts.\n\n` +
      `If you received this message, your Telegram notifications are working correctly.\n\n` +
      `You can manage your notification preferences in your MyPts account settings.`;

    // Try sending message using Telegram ID first (more reliable)
    try {
      logger.info(`Attempting to send verification message using Telegram ID: ${telegramId}`);

      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const apiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

      const response = await axios.post(apiUrl, {
        chat_id: telegramId,
        text: verificationMessage,
        parse_mode: 'Markdown'
      });

      logger.info(`Telegram API response (ID method): ${JSON.stringify(response.data)}`);

      if (response.data && response.data.ok) {
        logger.info(`Verification message successfully sent to Telegram ID: ${telegramId}`);
        return res.json({
          success: true,
          message: 'Verification message sent to your Telegram account',
          method: 'telegram_id'
        });
      } else {
        logger.warn(`Failed to send message using Telegram ID: ${JSON.stringify(response.data)}`);
        // Continue to try username method
      }
    } catch (idError: any) {
      logger.warn(`Error sending message using Telegram ID: ${telegramId}`);
      if (idError.response) {
        logger.warn(`Error code: ${idError.response.data?.error_code}, Description: ${idError.response.data?.description}`);
      } else {
        logger.warn(`Error message: ${idError.message}`);
      }
      // Continue to try username method
    }

    // If ID method failed, try username method
    logger.info(`Trying to send verification message using username: @${cleanUsername}`);

    try {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const apiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

      const response = await axios.post(apiUrl, {
        chat_id: `@${cleanUsername}`,
        text: verificationMessage,
        parse_mode: 'Markdown'
      });

      logger.info(`Telegram API response (username method): ${JSON.stringify(response.data)}`);

      if (response.data && response.data.ok) {
        logger.info(`Verification message successfully sent to @${cleanUsername}`);
        return res.json({
          success: true,
          message: 'Verification message sent to your Telegram account',
          method: 'username'
        });
      } else {
        logger.warn(`Failed to send message using username: ${JSON.stringify(response.data)}`);
        return res.status(400).json({
          success: false,
          message: 'Failed to send verification message. Please make sure you have started a chat with @MyPtsBot on Telegram.',
          reason: 'message_send_failed'
        });
      }
    } catch (usernameError: any) {
      logger.warn(`Error sending message using username @${cleanUsername}`);

      if (usernameError.response) {
        const errorCode = usernameError.response.data?.error_code;
        const errorDescription = usernameError.response.data?.description || '';

        logger.warn(`Error code: ${errorCode}, Description: ${errorDescription}`);

        if (errorDescription.includes('chat not found')) {
          return res.status(400).json({
            success: false,
            message: 'Telegram username not found. Please check that you entered your username correctly.',
            reason: 'username_not_found'
          });
        } else if (errorDescription.includes('bot can\'t initiate conversation')) {
          return res.status(400).json({
            success: false,
            message: 'You need to start a chat with @MyPtsBot first before we can send you messages.',
            reason: 'bot_chat_not_started'
          });
        } else {
          return res.status(400).json({
            success: false,
            message: `Telegram error: ${errorDescription || 'Unknown error'}`,
            reason: 'telegram_api_error'
          });
        }
      } else {
        return res.status(500).json({
          success: false,
          message: 'Network error when contacting Telegram. Please try again later.',
          reason: 'network_error'
        });
      }
    }
  } catch (error) {
    logger.error(`Error verifying Telegram connection for user ${user._id}:`, error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while verifying your Telegram connection',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
