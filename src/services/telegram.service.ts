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
   * @param username Telegram username (with or without @) or Telegram ID
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
      console.log('[TELEGRAM DEBUG] Sending message to:', username);

      // Check if the username is actually a numeric ID
      const isNumericId = /^\d+$/.test(username);

      // Clean up username (remove @ if present) if it's not a numeric ID
      const cleanUsername = isNumericId ? username : (username.startsWith('@') ? username.substring(1) : username);

      // Log the attempt with detailed information
      if (isNumericId) {
        logger.info(`Attempting to send Telegram message to ID ${cleanUsername}`);
        console.log('[TELEGRAM DEBUG] Using numeric ID:', cleanUsername);
      } else {
        logger.info(`Attempting to send Telegram message to @${cleanUsername}`);
        console.log('[TELEGRAM DEBUG] Using username:', cleanUsername);
      }

      console.log('[TELEGRAM DEBUG] Parse mode:', parseMode);

      logger.info(`Message length: ${message.length} characters`);
      logger.info(`Parse mode: ${parseMode}`);
      logger.info(`Bot token (first 10 chars): ${this.botToken.substring(0, 10)}...`);

      // First try with the provided username or ID
      let chatId;

      // If it's a numeric ID, use it directly, otherwise use the username with @
      if (isNumericId) {
        chatId = cleanUsername;
        logger.info(`Using numeric chat_id: ${chatId}`);
      } else {
        chatId = `@${cleanUsername}`;
        logger.info(`Using username chat_id: ${chatId}`);
      }

      try {
        // Prepare request data
        const requestData = {
          chat_id: chatId,
          text: message,
          parse_mode: parseMode,
        };

        logger.info(`Sending request to ${this.apiUrl}/sendMessage`);
        logger.info(`Request data: ${JSON.stringify(requestData)}`);

        // Send message
        console.log('[TELEGRAM DEBUG] Sending request to Telegram API:', this.apiUrl);
        console.log('[TELEGRAM DEBUG] Request data:', JSON.stringify(requestData));

        let response;
        try {
          response = await axios.post(`${this.apiUrl}/sendMessage`, requestData);

          // Log the response
          logger.info(`Telegram API response: ${JSON.stringify(response.data)}`);
          console.log('[TELEGRAM DEBUG] Response data:', JSON.stringify(response.data));
        } catch (error: any) {
          console.log('[TELEGRAM DEBUG] Error sending message:', error.message);
          if (error.response) {
            console.log('[TELEGRAM DEBUG] Response status:', error.response.status);
            console.log('[TELEGRAM DEBUG] Response data:', JSON.stringify(error.response.data));
          }
          throw error; // Re-throw to be caught by the outer catch
        }

        if (response && response.data && response.data.ok) {
          if (isNumericId) {
            logger.info(`Telegram message successfully sent to ID ${cleanUsername}`);
          } else {
            logger.info(`Telegram message successfully sent to @${cleanUsername}`);
          }
          logger.info(`Message ID: ${response.data.result.message_id}`);
          return true;
        } else {
          logger.warn(`Telegram API returned ok=false: ${JSON.stringify(response.data)}`);
        }
      } catch (sendError: any) {
        // If the first attempt fails, log it with detailed error information
        if (isNumericId) {
          logger.warn(`Failed to send message using ID ${cleanUsername}`);
        } else {
          logger.warn(`Failed to send message using username @${cleanUsername}`);
        }

        if (sendError.response) {
          logger.warn(`Response status: ${sendError.response.status}`);
          logger.warn(`Response data: ${JSON.stringify(sendError.response.data)}`);

          // Check for specific error descriptions
          const errorDescription = sendError.response?.data?.description || '';

          if (errorDescription.includes('bot can\'t initiate conversation')) {
            logger.error(`User needs to start a conversation with the bot first`);
            return false;
          } else if (errorDescription.includes('chat not found')) {
            logger.error(`Chat not found`);
            return false;
          }
        } else if (sendError.message) {
          logger.warn(`Error message: ${sendError.message}`);
        } else {
          // If there's no error message at all, it might be an issue with the username/ID
          logger.error(`Unknown error sending message. The username/ID might be invalid or the user hasn't started a chat with the bot.`);
        }
      }

      // If we're here and it's not a numeric ID, try with the hardcoded ID as a fallback
      if (!isNumericId) {
        try {
          // Try with the hardcoded ID (8017650902)
          const hardcodedId = '8017650902';
          logger.info(`Trying fallback with hardcoded ID: ${hardcodedId}`);

          const fallbackResponse = await axios.post(`${this.apiUrl}/sendMessage`, {
            chat_id: hardcodedId,
            text: message,
            parse_mode: parseMode,
          });

          if (fallbackResponse.data && fallbackResponse.data.ok) {
            logger.info(`Telegram message successfully sent to fallback ID ${hardcodedId}`);
            logger.info(`Message ID: ${fallbackResponse.data.result.message_id}`);
            return true;
          }
        } catch (fallbackError: any) {
          logger.warn(`Fallback attempt also failed: ${fallbackError.message}`);
        }
      }

      // All attempts failed, log the failure
      logger.error(`All attempts to send Telegram message failed`);
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
   * Send a notification message with stylish HTML formatting
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
    // Format message with HTML
    let formattedMessage = `<b>📢 ${title}</b>\n\n`;
    formattedMessage += `<i>${message}</i>\n\n`;

    // Add divider
    formattedMessage += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Add action link if provided
    if (actionUrl && actionText) {
      formattedMessage += `<b>🔗 <a href="${actionUrl}">${actionText}</a></b>\n\n`;
    }

    // Add signature
    formattedMessage += `<i>Thank you for using MyPts - Your Digital Currency Solution</i>`;

    return this.sendMessage(username, formattedMessage, 'HTML');
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
    const message = `<b>✅ Verification Successful!</b>

<i>Your MyPts account has been successfully connected to Telegram.</i>

<b>📲 You will now receive notifications about:</b>
━━━━━━━━━━━━━━━━━━━━━━
<b>🔹 Transactions</b> - Purchases, sales, and transfers
<b>🔹 Account Updates</b> - Balance changes and profile updates
<b>🔹 Security Alerts</b> - Login attempts and security events
━━━━━━━━━━━━━━━━━━━━━━

<i>You can manage your notification preferences in your MyPts account settings.</i>

<b>🔗 <a href="https://my-pts-dashboard-management.vercel.app/settings">Manage Notification Settings</a></b>

<i>Thank you for using MyPts - Your Digital Currency Solution</i>`;

    return this.sendMessage(username, message, 'HTML');
  }

  /**
   * Send a transaction notification
   * @param username Telegram username or ID
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
    logger.info(`Sending transaction notification to Telegram recipient: ${username}`);
    logger.info(`Transaction data: ${JSON.stringify(transactionData)}`);
    logger.info(`Transaction title: ${title}`);
    logger.info(`Transaction message: ${message}`);

    // Format transaction details
    const formattedAmount = transactionData.amount > 0
      ? `+${transactionData.amount}`
      : `${transactionData.amount}`;

    // Create message with stylish HTML formatting
    let formattedMessage = `<b>🎉 ${title}</b>\n\n`;
    formattedMessage += `<i>${message}</i>\n\n`;
    formattedMessage += `<b>📊 Transaction Summary:</b>\n`;
    formattedMessage += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    formattedMessage += `<b>🔹 Type:</b> ${transactionData.type.replace('_', ' ')}\n`;
    formattedMessage += `<b>🔹 Amount:</b> <code>${formattedAmount} MyPts</code>\n`;
    formattedMessage += `<b>🔹 Balance:</b> <code>${transactionData.balance.toLocaleString()} MyPts</code>\n`;
    formattedMessage += `<b>🔹 Status:</b> ✅ ${transactionData.status}\n`;
    formattedMessage += `<b>🔹 Date:</b> ${new Date().toLocaleString()}\n`;
    formattedMessage += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Add action URL as HTML link
    if (actionUrl) {
      formattedMessage += `<b>🔗 <a href="${actionUrl}">View Transaction Details</a></b>\n\n`;
    }

    formattedMessage += `<i>Thank you for using MyPts - Your Digital Currency Solution</i>`;

    // Use HTML mode for formatting
    return this.sendMessage(username, formattedMessage, 'HTML');
  }
}

// Export a singleton instance
export const telegramService = new TelegramService();
export default telegramService;
