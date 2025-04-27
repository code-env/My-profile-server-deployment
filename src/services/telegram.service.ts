import axios from 'axios';
import { logger } from '../utils/logger';
import { config } from '../config/config';

/**
 * Service for sending Telegram notifications
 */
class TelegramService {
  private botToken: string;
  private apiUrl: string;

  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';
    this.apiUrl = `https://api.telegram.org/bot${this.botToken}`;

    logger.info(`Initializing Telegram service with token: ${this.botToken ? this.botToken.substring(0, 10) + '...' : 'not set'}`);
    logger.info(`Telegram API URL: ${this.apiUrl}`);

    if (!this.botToken) {
      logger.warn('TELEGRAM_BOT_TOKEN not set. Telegram notifications will not work.');
    } else {
      this.verifyBotToken();
    }
  }

  /**
   * Verify that the bot token is valid
   */
  private async verifyBotToken(): Promise<void> {
    try {
      logger.info(`Verifying Telegram bot token by calling getMe API...`);
      const response = await axios.get(`${this.apiUrl}/getMe`);

      logger.info(`Telegram API response: ${JSON.stringify(response.data)}`);

      if (response.data && response.data.ok) {
        const botInfo = response.data.result;
        logger.info(`Telegram bot connected successfully: @${botInfo.username}`);
        logger.info(`Bot ID: ${botInfo.id}, First Name: ${botInfo.first_name}, Can Join Groups: ${botInfo.can_join_groups}`);
      } else {
        logger.error(`Invalid Telegram bot token. Response: ${JSON.stringify(response.data)}`);
      }
    } catch (error: any) {
      logger.error('Failed to verify Telegram bot token:', error);
      if (error.response) {
        logger.error(`Response status: ${error.response.status}`);
        logger.error(`Response data: ${JSON.stringify(error.response.data)}`);
      }
    }
  }

  /**
   * Send a message to a Telegram user
   * @param username Telegram username (with or without @)
   * @param message Message to send
   * @param parseMode Parse mode for the message (Markdown or HTML)
   */
  public async sendMessage(
    username: string,
    message: string,
    parseMode: 'Markdown' | 'HTML' = 'Markdown'
  ): Promise<boolean> {
    if (!this.botToken) {
      logger.warn('Cannot send Telegram message: Bot token not set');
      return false;
    }

    try {
      // Clean up username (remove @ if present)
      const cleanUsername = username.startsWith('@') ? username.substring(1) : username;

      // Log the attempt with detailed information
      logger.info(`Attempting to send Telegram message to @${cleanUsername}`);
      logger.info(`Message length: ${message.length} characters`);
      logger.info(`Parse mode: ${parseMode}`);
      logger.info(`Bot token (first 10 chars): ${this.botToken.substring(0, 10)}...`);

      // First try to get chat ID by username
      let chatId;

      try {
        // Try to use the username directly
        chatId = `@${cleanUsername}`;
        logger.info(`Using chat_id: ${chatId}`);

        // Prepare request data
        const requestData = {
          chat_id: chatId,
          text: message,
          parse_mode: parseMode,
        };

        logger.info(`Sending request to ${this.apiUrl}/sendMessage`);
        logger.info(`Request data: ${JSON.stringify(requestData)}`);

        // Send message
        const response = await axios.post(`${this.apiUrl}/sendMessage`, requestData);

        // Log the response
        logger.info(`Telegram API response: ${JSON.stringify(response.data)}`);

        if (response.data && response.data.ok) {
          logger.info(`Telegram message successfully sent to @${cleanUsername}`);
          logger.info(`Message ID: ${response.data.result.message_id}`);
          return true;
        } else {
          logger.warn(`Telegram API returned ok=false: ${JSON.stringify(response.data)}`);
        }
      } catch (usernameError: any) {
        // If username approach fails, log it with detailed error information
        logger.warn(`Failed to send message using username @${cleanUsername}`);

        if (usernameError.response) {
          logger.warn(`Response status: ${usernameError.response.status}`);
          logger.warn(`Response data: ${JSON.stringify(usernameError.response.data)}`);

          // Check for specific error descriptions
          const errorDescription = usernameError.response?.data?.description || '';

          if (errorDescription.includes('bot can\'t initiate conversation')) {
            logger.error(`User @${cleanUsername} needs to start a conversation with the bot first`);
            return false;
          } else if (errorDescription.includes('chat not found')) {
            logger.error(`Chat with username @${cleanUsername} not found`);
            return false;
          }
        } else if (usernameError.message) {
          logger.warn(`Error message: ${usernameError.message}`);
        } else {
          // If there's no error message at all, it might be an issue with the username
          logger.error(`Unknown error sending message to @${cleanUsername}. The username might be invalid or the user hasn't started a chat with the bot.`);
        }
      }

      // Try to get user information
      try {
        logger.info(`Attempting to get chat information for @${cleanUsername}`);
        const chatResponse = await axios.get(`${this.apiUrl}/getChat`, {
          params: {
            chat_id: `@${cleanUsername}`
          }
        });

        logger.info(`Chat info response: ${JSON.stringify(chatResponse.data)}`);
      } catch (chatError: any) {
        logger.warn(`Failed to get chat information: ${chatError.message}`);
        if (chatError.response) {
          logger.warn(`Response status: ${chatError.response.status}`);
          logger.warn(`Response data: ${JSON.stringify(chatError.response.data)}`);
        }
      }

      // Log failure
      logger.error(`Failed to send Telegram message to @${cleanUsername}`);
      return false;
    } catch (error: any) {
      logger.error('Error sending Telegram message:', error.message);
      if (error.response) {
        logger.error(`Response status: ${error.response.status}`);
        logger.error(`Response data: ${JSON.stringify(error.response.data)}`);
      }
      return false;
    }
  }

  /**
   * Send a notification message with formatting
   * @param username Telegram username
   * @param title Notification title
   * @param message Notification message
   * @param actionUrl Optional action URL
   * @param actionText Optional action text
   */
  public async sendNotification(
    username: string,
    title: string,
    message: string,
    actionUrl?: string,
    actionText?: string
  ): Promise<boolean> {
    // Format message with Markdown
    let formattedMessage = `*${title}*\n\n${message}`;

    // Add action link if provided
    if (actionUrl && actionText) {
      formattedMessage += `\n\n[${actionText}](${actionUrl})`;
    }

    return this.sendMessage(username, formattedMessage);
  }

  /**
   * Check if a Telegram username is valid and can receive messages
   * @param username Telegram username
   * @returns Promise<{valid: boolean, reason?: string}> Result of the check
   */
  public async checkUsername(username: string): Promise<{valid: boolean, reason?: string}> {
    if (!this.botToken) {
      logger.warn('Cannot check Telegram username: Bot token not set');
      return { valid: false, reason: 'Bot token not set' };
    }

    try {
      // Clean up username (remove @ if present)
      const cleanUsername = username.startsWith('@') ? username.substring(1) : username;

      // Check if username follows Telegram's username format
      const usernameRegex = /^[a-zA-Z0-9_]{5,32}$/;
      if (!usernameRegex.test(cleanUsername)) {
        return {
          valid: false,
          reason: 'Invalid username format. Telegram usernames must be 5-32 characters and can only contain letters, numbers, and underscores.'
        };
      }

      // Try to get chat information
      try {
        logger.info(`Checking if username @${cleanUsername} is valid`);

        // Let's try a simpler approach - just try to send a test message
        // This is more reliable than checking if the username exists
        logger.info(`Attempting to send a test message to @${cleanUsername}`);

        const testMessage = "This is a test message to verify your Telegram connection. If you receive this, your connection is working!";

        try {
          const response = await axios.post(`${this.apiUrl}/sendMessage`, {
            chat_id: `@${cleanUsername}`,
            text: testMessage,
            parse_mode: 'Markdown'
          });

          logger.info(`Test message response: ${JSON.stringify(response.data)}`);

          if (response.data && response.data.ok) {
            logger.info(`Successfully sent test message to @${cleanUsername}`);
            return { valid: true };
          } else {
            logger.warn(`Failed to send test message to @${cleanUsername}: ${JSON.stringify(response.data)}`);
            return { valid: false, reason: 'Failed to send test message' };
          }
        } catch (sendError: any) {
          logger.warn(`Error sending test message to @${cleanUsername}`);

          if (sendError.response) {
            const errorCode = sendError.response.data?.error_code;
            const errorDescription = sendError.response.data?.description || '';

            logger.warn(`Error code: ${errorCode}, Description: ${errorDescription}`);

            if (errorDescription.includes('chat not found')) {
              return { valid: false, reason: 'Username not found' };
            } else if (errorDescription.includes('bot can\'t initiate conversation')) {
              return { valid: false, reason: 'User needs to start chat with bot first' };
            } else {
              return { valid: false, reason: errorDescription || 'Failed to send message' };
            }
          } else {
            logger.warn(`No response data available: ${sendError.message}`);
            return { valid: false, reason: sendError.message || 'Network error' };
          }
        }
      } catch (error: any) {
        logger.error(`Unexpected error checking username @${cleanUsername}:`, error);

        if (error.response) {
          logger.error(`Response status: ${error.response.status}`);
          logger.error(`Response data: ${JSON.stringify(error.response.data)}`);
          return { valid: false, reason: error.response.data?.description || 'API error' };
        } else if (error.request) {
          logger.error(`No response received: ${error.message}`);
          return { valid: false, reason: 'No response from Telegram API' };
        } else {
          logger.error(`Error message: ${error.message}`);
          return { valid: false, reason: error.message || 'Unknown error' };
        }
      }
    } catch (error: any) {
      logger.error('Error checking Telegram username:', error.message);
      return { valid: false, reason: 'Internal error' };
    }
  }

  /**
   * Send a verification message to confirm Telegram connection
   * @param username Telegram username
   * @returns Promise<boolean> indicating success or failure
   */
  public async sendVerificationMessage(username: string): Promise<boolean> {
    const message = `*Verification Successful!* ✅\n\n` +
      `Your MyPts account has been successfully connected to Telegram.\n\n` +
      `You will now receive notifications about:\n` +
      `• Transactions\n` +
      `• Account updates\n` +
      `• Security alerts\n\n` +
      `You can manage your notification preferences in your MyPts account settings.`;

    return this.sendMessage(username, message);
  }

  /**
   * Send a transaction notification
   * @param username Telegram username
   * @param title Notification title
   * @param message Notification message
   * @param transactionData Transaction data
   * @param actionUrl Optional action URL
   */
  public async sendTransactionNotification(
    username: string,
    title: string,
    message: string,
    transactionData: {
      id: string;
      type: string;
      amount: number;
      balance: number;
      status: string;
    },
    actionUrl?: string
  ): Promise<boolean> {
    // Format transaction details
    const formattedAmount = transactionData.amount > 0
      ? `+${transactionData.amount}`
      : `${transactionData.amount}`;

    // Create message with transaction details
    let formattedMessage = `*${title}*\n\n${message}\n\n`;
    formattedMessage += `*Transaction Details:*\n`;
    formattedMessage += `• Type: ${transactionData.type}\n`;
    formattedMessage += `• Amount: ${formattedAmount} MyPts\n`;
    formattedMessage += `• Balance: ${transactionData.balance} MyPts\n`;
    formattedMessage += `• Status: ${transactionData.status}\n`;

    // Add action link if provided
    if (actionUrl) {
      formattedMessage += `\n[View Transaction Details](${actionUrl})`;
    }

    return this.sendMessage(username, formattedMessage);
  }
}

// Export a singleton instance
export const telegramService = new TelegramService();
export default telegramService;
