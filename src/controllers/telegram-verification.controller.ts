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
  const { username, telegramId: providedTelegramId } = req.body;

  // Get user's Telegram ID from database if available, or use the one provided in the request
  const telegramId = providedTelegramId || user.telegramNotifications?.telegramId;

  if (!username && !telegramId) {
    return res.status(400).json({
      success: false,
      message: 'Either Telegram username or Telegram ID is required'
    });
  }

  try {
    // Clean up username (remove @ if present)
    const cleanUsername = username.startsWith('@') ? username.substring(1) : username;

    logger.info(`Verifying Telegram connection for user ${user._id} with username @${cleanUsername}${telegramId ? ` and ID ${telegramId}` : ''}`);

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

    // Try sending message using Telegram ID first (more reliable) if available
    if (telegramId) {
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

          // Update user's Telegram settings in the database
          if (user.telegramNotifications) {
            user.telegramNotifications.enabled = true;
            user.telegramNotifications.username = cleanUsername;
            user.telegramNotifications.telegramId = telegramId;
          } else {
            user.telegramNotifications = {
              enabled: true,
              username: cleanUsername,
              telegramId: telegramId
            };
          }
          await user.save();

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
    } else {
      logger.info('No Telegram ID available for this user, trying username method only');
    }

    // If ID method failed, try username method
    logger.info(`Trying to send verification message using username: @${cleanUsername}`);

    // First, try to check if the user has started a chat with the bot and get their chat ID
    // This is a common reason for "chat not found" errors
    let userChatId = null;

    try {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const getUpdatesUrl = `https://api.telegram.org/bot${botToken}/getUpdates?limit=100`;

      logger.info(`Checking if user @${cleanUsername} has started a chat with the bot`);

      const updatesResponse = await axios.get(getUpdatesUrl);

      if (updatesResponse.data && updatesResponse.data.ok) {
        const updates = updatesResponse.data.result || [];

        // Look for the user in recent updates
        for (const update of updates) {
          const message = update.message || {};
          const from = message.from || {};
          const chat = message.chat || {};

          // Check by username (case insensitive)
          if (from.username && from.username.toLowerCase() === cleanUsername.toLowerCase()) {
            userChatId = chat.id;
            logger.info(`Found user @${cleanUsername} in recent bot updates with chat ID: ${userChatId}`);
            break;
          }

          // Also check by first name and last name if available
          if (from.first_name && from.last_name) {
            const fullName = `${from.first_name} ${from.last_name}`.toLowerCase();
            if (fullName.includes(cleanUsername.toLowerCase())) {
              userChatId = chat.id;
              logger.info(`Found possible match for user @${cleanUsername} by name: ${fullName} with chat ID: ${userChatId}`);
              break;
            }
          }
        }

        if (!userChatId) {
          logger.warn(`User @${cleanUsername} not found in recent bot updates. They may not have started a chat with the bot.`);
          logger.info(`Suggesting user to send a message to @MyPtsBot with text: /start ${cleanUsername}`);
        }
      }
    } catch (error: any) {
      const errorMessage = error?.message || 'Unknown error';
      logger.warn(`Error checking if user has started chat with bot: ${errorMessage}`);
      // Continue anyway, as this is just a diagnostic check
    }

    try {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const apiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

      // Try different formats for the username
      // According to Telegram API docs, for usernames we should use the format with @ symbol
      // But we'll try both formats just to be safe
      const chatIdFormats = [];

      // If we found the user's chat ID from getUpdates, use that first (most reliable)
      if (userChatId) {
        chatIdFormats.push(userChatId.toString());
      }

      // Add other formats as fallbacks
      chatIdFormats.push(
        `@${cleanUsername}`,  // With @ symbol (recommended format)
        cleanUsername,        // Without @ symbol
        `${cleanUsername}`,   // As a plain string
        `${cleanUsername.toLowerCase()}` // Lowercase version
      );

      // Also try to get the chat ID directly if possible
      try {
        const getChatUrl = `https://api.telegram.org/bot${botToken}/getChat?chat_id=@${cleanUsername}`;
        const chatResponse = await axios.get(getChatUrl);

        if (chatResponse.data && chatResponse.data.ok && chatResponse.data.result) {
          const chat = chatResponse.data.result;
          if (chat.id) {
            // Add the numeric chat ID to the formats to try
            chatIdFormats.unshift(chat.id.toString());
            logger.info(`Found chat ID ${chat.id} for username @${cleanUsername}`);
          }
        }
      } catch (error: any) {
        const errorMessage = error?.message || 'Unknown error';
        logger.warn(`Could not get chat ID for username @${cleanUsername}: ${errorMessage}`);
        // Continue with the other formats
      }

      let response;
      let success = false;
      let errorMessage = '';

      // Try each format until one works
      for (const chatId of chatIdFormats) {
        try {
          logger.info(`Attempting with chat_id format: ${chatId}`);
          response = await axios.post(apiUrl, {
            chat_id: chatId,
            text: verificationMessage,
            parse_mode: 'Markdown'
          });

          if (response.data && response.data.ok) {
            success = true;
            logger.info(`Success with format: ${chatId}`);
            break;
          }
        } catch (formatError: any) {
          errorMessage = formatError.message;
          logger.warn(`Format ${chatId} failed: ${errorMessage}`);
          // Continue to next format
        }
      }

      // If all formats failed, throw the last error
      if (!success && !response) {
        throw new Error(errorMessage || 'All chat_id formats failed');
      }

      // At this point, response is guaranteed to be defined because:
      // 1. If success is true, we broke out of the loop with a valid response
      // 2. If success is false but response exists, we'll use that response
      // 3. If success is false and response doesn't exist, we would have thrown an error above
      // TypeScript doesn't know this, so we need to assert that response is defined
      const responseData = response!.data;

      logger.info(`Telegram API response (username method): ${JSON.stringify(responseData)}`);

      if (responseData && responseData.ok) {
        logger.info(`Verification message successfully sent to @${cleanUsername}`);

        // Update user's Telegram settings in the database
        if (user.telegramNotifications) {
          user.telegramNotifications.enabled = true;
          user.telegramNotifications.username = cleanUsername;
        } else {
          user.telegramNotifications = {
            enabled: true,
            username: cleanUsername
          };
        }
        await user.save();

        return res.json({
          success: true,
          message: 'Verification message sent to your Telegram account',
          method: 'username'
        });
      } else {
        logger.warn(`Failed to send message using username: ${JSON.stringify(responseData)}`);
        return res.status(400).json({
          success: false,
          message: 'Failed to send verification message. Please make sure you have started a chat with @MyPtsBot on Telegram.',
          reason: 'message_send_failed'
        });
      }
    } catch (usernameError: any) {
      logger.warn(`Error sending message using username @${cleanUsername}`);

      // Log the full error for debugging
      logger.error(`Full error details: ${JSON.stringify(usernameError.message || 'No message')}`);

      if (usernameError.stack) {
        logger.error(`Error stack trace: ${usernameError.stack}`);
      }

      if (usernameError.response) {
        const errorCode = usernameError.response.data?.error_code;
        const errorDescription = usernameError.response.data?.description || '';

        logger.warn(`Error code: ${errorCode}, Description: ${errorDescription}`);

        if (errorDescription.includes('chat not found')) {
          return res.status(400).json({
            success: false,
            message: 'Telegram username not found. Please make sure you have sent the message "/start" to @MyPtsBot and check that you entered your username correctly.',
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
        logger.error(`Non-response error when contacting Telegram: ${usernameError.message || 'Unknown error'}`);
        return res.status(400).json({
          success: false,
          message: 'Error contacting Telegram. Please try again later or try using a different username.',
          reason: 'telegram_error',
          details: usernameError.message
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
