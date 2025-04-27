import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { telegramService } from '../services/telegram.service';
import { User } from '../models/User';

/**
 * @desc    Test direct Telegram transaction notification
 * @route   POST /api/test/telegram/transaction
 * @access  Private
 */
export const testDirectTelegramTransaction = async (req: Request, res: Response) => {
  const user = req.user as any;

  try {
    // Get the user with all fields
    const fullUser = await User.findById(user._id).select('+telegramNotifications');

    if (!fullUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Log user details
    logger.info(`Testing direct Telegram transaction notification for user ${fullUser._id}`, {
      telegramEnabled: fullUser.telegramNotifications?.enabled,
      telegramUsername: fullUser.telegramNotifications?.username,
      telegramId: fullUser.telegramNotifications?.telegramId
    });

    // Check if Telegram is enabled
    if (!fullUser.telegramNotifications?.enabled) {
      return res.status(400).json({
        success: false,
        message: 'Telegram notifications are not enabled for this user'
      });
    }

    // Get Telegram recipient
    const telegramId = fullUser.telegramNotifications.telegramId;
    const telegramUsername = fullUser.telegramNotifications.username;
    const telegramRecipient = telegramId || telegramUsername;

    if (!telegramRecipient) {
      return res.status(400).json({
        success: false,
        message: 'No Telegram username or ID found for this user'
      });
    }

    logger.info(`Sending direct test transaction notification to ${telegramRecipient}`);

    // Create a stylish test transaction notification with HTML formatting
    const result = await telegramService.sendMessage(
      telegramRecipient,
      `<b>🧪 Test Transaction Notification</b>

<i>This is a test notification to verify that Telegram notifications are working correctly.</i>

<b>📊 Transaction Summary:</b>
━━━━━━━━━━━━━━━━━━━━━━
<b>🔹 Type:</b> BUY MYPTS
<b>🔹 Amount:</b> <code>+100 MyPts</code>
<b>🔹 Balance:</b> <code>500 MyPts</code>
<b>🔹 Status:</b> ✅ COMPLETED
<b>🔹 Date:</b> ${new Date().toLocaleString()}
━━━━━━━━━━━━━━━━━━━━━━

<b>🔗 <a href="https://my-pts-dashboard-management.vercel.app/dashboard/transactions">View Transaction Details</a></b>

<i>Thank you for using MyPts - Your Digital Currency Solution</i>`,
      'HTML' // Use HTML mode for formatting
    );

    if (result) {
      logger.info(`Direct test transaction notification sent successfully to ${telegramRecipient}`);
      return res.status(200).json({
        success: true,
        message: 'Test transaction notification sent successfully',
        recipient: telegramRecipient
      });
    } else {
      logger.error(`Failed to send direct test transaction notification to ${telegramRecipient}`);
      return res.status(500).json({
        success: false,
        message: 'Failed to send test transaction notification'
      });
    }
  } catch (error: any) {
    logger.error(`Error sending direct test transaction notification: ${error.message}`, error);
    return res.status(500).json({
      success: false,
      message: 'Error sending test transaction notification',
      error: error.message
    });
  }
};
