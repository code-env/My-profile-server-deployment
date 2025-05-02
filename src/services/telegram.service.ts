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

    // Log the message being sent for debugging
    logger.info(`Sending Telegram message to ${username} with parse mode: ${parseMode}`);
    if (parseMode === 'HTML') {
      logger.info(`HTML message length: ${message.length} characters`);
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
          parse_mode: parseMode
        };

        // Send the message
        const response = await axios.post(`${this.apiUrl}/sendMessage`, requestData);
        
        logger.info(`Telegram API response: ${JSON.stringify(response.data)}`);

        if (response.data && response.data.ok) {
          logger.info(`Successfully sent message to ${chatId}`);
          return true;
        } else {
          logger.warn(`Failed to send message to ${chatId}: ${JSON.stringify(response.data)}`);
          return false;
        }
      } catch (error: any) {
        logger.error(`Error sending message to ${chatId}:`, error.message);

        // If the error is that the chat ID is not found, try again with a different format
        if (error.response && error.response.data && error.response.data.description && 
            (error.response.data.description.includes('chat not found') || 
             error.response.data.description.includes('user not found') ||
             error.response.data.description.includes('chat_id is empty'))) {
          
          logger.info(`Chat ID ${chatId} not found, trying alternative format...`);
          
          // If we tried with username, try with numeric ID if possible
          if (!isNumericId) {
            // Try to parse as numeric ID
            const numericId = parseInt(cleanUsername);
            if (!isNaN(numericId)) {
              logger.info(`Trying with numeric ID: ${numericId}`);
              
              const alternativeRequestData = {
                chat_id: numericId,
                text: message,
                parse_mode: parseMode
              };
              
              try {
                const alternativeResponse = await axios.post(`${this.apiUrl}/sendMessage`, alternativeRequestData);
                
                if (alternativeResponse.data && alternativeResponse.data.ok) {
                  logger.info(`Successfully sent message to numeric ID ${numericId}`);
                  return true;
                }
              } catch (alternativeError: any) {
                logger.error(`Error sending message to numeric ID ${numericId}:`, alternativeError.message);
              }
            }
          }
          
          // If we tried with numeric ID, try with username
          else {
            logger.info(`Trying with username: @${cleanUsername}`);
            
            const alternativeRequestData = {
              chat_id: `@${cleanUsername}`,
              text: message,
              parse_mode: parseMode
            };
            
            try {
              const alternativeResponse = await axios.post(`${this.apiUrl}/sendMessage`, alternativeRequestData);
              
              if (alternativeResponse.data && alternativeResponse.data.ok) {
                logger.info(`Successfully sent message to username @${cleanUsername}`);
                return true;
              }
            } catch (alternativeError: any) {
              logger.error(`Error sending message to username @${cleanUsername}:`, alternativeError.message);
            }
          }
        }
        
        return false;
      }
    } catch (error: any) {
      logger.error('Error in sendMessage:', error);
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
    // Create HTML formatted message
    let formattedMessage = `<b>${title}</b>\n\n`;
    formattedMessage += `${message}\n\n`;
    
    // Add action button if URL is provided
    if (actionUrl) {
      const buttonText = actionText || 'View Details';
      formattedMessage += `<a href="${actionUrl}">${buttonText}</a>`;
    }
    
    return this.sendMessage(username, formattedMessage, 'HTML');
  }

  /**
   * Check if a Telegram username is valid and can receive messages
   * @param username Telegram username
   * @returns Promise<{valid: boolean, reason?: string}> Result of the check
   */
  public async checkUsername(username: string): Promise<{valid: boolean, reason?: string}> {
    if (!this.botToken) {
      return { valid: false, reason: 'Bot token not set' };
    }
    
    if (!username) {
      return { valid: false, reason: 'Username is empty' };
    }
    
    // Clean up username (remove @ if present)
    const cleanUsername = username.startsWith('@') ? username.substring(1) : username;
    
    // Check if it's a numeric ID
    const isNumericId = /^\d+$/.test(cleanUsername);
    
    // If it's a numeric ID, we need to check if it's a valid chat ID
    if (isNumericId) {
      try {
        // Try to send a test message
        const testMessage = 'Checking if this chat ID is valid. Please ignore this message.';
        const result = await this.sendMessage(cleanUsername, testMessage);
        
        if (result) {
          return { valid: true };
        } else {
          return { valid: false, reason: 'Failed to send test message to chat ID' };
        }
      } catch (error: any) {
        return { valid: false, reason: `Error checking chat ID: ${error.message}` };
      }
    }
    
    // If it's a username, check if it's valid
    if (cleanUsername.length < 5) {
      return { valid: false, reason: 'Username is too short (minimum 5 characters)' };
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
      return { valid: false, reason: 'Username contains invalid characters (only letters, numbers, and underscore are allowed)' };
    }
    
    try {
      // Try to send a test message
      const testMessage = 'Checking if this username is valid. Please ignore this message.';
      const result = await this.sendMessage(`@${cleanUsername}`, testMessage);
      
      if (result) {
        return { valid: true };
      } else {
        return { valid: false, reason: 'Failed to send test message to username' };
      }
    } catch (error: any) {
      return { valid: false, reason: `Error checking username: ${error.message}` };
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
    
    // Format transaction details
    const formattedAmount = transactionData.amount > 0
      ? `+${transactionData.amount}`
      : `${transactionData.amount}`;
    
    // Debug logging
    console.log('[TELEGRAM DEBUG] Using new format for all transactions');
    console.log('[TELEGRAM DEBUG] Transaction type:', transactionData.type);
    
    // Always use the new format
    const displayTitle = "MyPts Purchase Successful";
    const date = new Date().toLocaleDateString('en-US', { 
      month: '2-digit', 
      day: '2-digit', 
      year: 'numeric' 
    });
    
    // Create the transaction ID portion - use short ID or full ID
    const shortId = transactionData.id.length > 6 ? 
      transactionData.id.substring(0, 6) : transactionData.id;
    
    // Build the message
    let formattedMessage = `<b>🎉 ${displayTitle}</b>\n\n`;
    formattedMessage += `Transaction #${shortId} (${date})\n`;
    formattedMessage += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    formattedMessage += `🔹 Type: ${transactionData.type.replace('_', ' ')}\n`;
    formattedMessage += `🔹 Amount: ${formattedAmount} MyPts\n`;
    formattedMessage += `🔹 Balance: ${transactionData.balance.toLocaleString()} MyPts\n`;
    formattedMessage += `🔹 Payment: Credit Card\n`;
    formattedMessage += `🔹 Status: ✅ ${transactionData.status}\n`;
    formattedMessage += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    // Format URLs
    const baseUrl = config.CLIENT_URL.startsWith('http') ? 
      config.CLIENT_URL : `https://${config.CLIENT_URL}`;
    const transactionUrl = actionUrl?.startsWith('http') ? 
      actionUrl : `${baseUrl}${actionUrl}`;
    const receiptUrl = `${baseUrl}/dashboard/transactions/${transactionData.id}/receipt`;
    const helpUrl = `${baseUrl}/help`;
    
    // Add links
    formattedMessage += `<a href="${transactionUrl}">🔗 View Details</a>  |  `;
    formattedMessage += `<a href="${receiptUrl}">📝 Receipt</a>  |  `;
    formattedMessage += `<a href="${helpUrl}">❓ Help</a>\n\n`;
    formattedMessage += `<i>Thank you for using MyPts - Your Digital Currency Solution</i>`;
    
    // Send the message
    return this.sendMessage(username, formattedMessage, 'HTML');
  }
}

// Export a singleton instance
export const telegramService = new TelegramService();
export default telegramService;
