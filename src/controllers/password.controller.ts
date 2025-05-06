import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { logger } from '../utils/logger';
import { AppError, isAppError } from '../errors';
import { randomBytes } from 'crypto';
import EmailService from '../services/email.service';
import { config } from '../config/config';
import { User } from '../models/User';

export class PasswordController {
  /**
   * Initiate password reset process
   * @route POST /auth/forgot-password
   */
  static async forgotPassword(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;
      if (!email) {
        res.status(400).json({ success: false, message: 'Email is required' });
        return;
      }

      // Generate a reset token
      const resetToken = randomBytes(32).toString('hex');

      // Call AuthService to handle the logic
      await AuthService.setResetToken(email, resetToken);

      // Fetch user to get their name for the email
      const user = await User.findOne({ email });

      // Define expiry time for the reset link (e.g., 60 minutes)
      const expiryMinutes = 60;

      // Get client info for email
      const clientInfo = {
        ipAddress: req.ip || 'Unknown',
        userAgent: req.get('user-agent') || 'Unknown'
      };

      // Send reset email with the token
      const resetUrl = `${config.CLIENT_URL}/reset-password?token=${resetToken}`;
      // Use user's name if available, otherwise use a default greeting
      const userName = user?.fullName || user?.username || 'User';
      await EmailService.sendPasswordResetEmail(email, resetUrl, userName, expiryMinutes, clientInfo);

      res.status(200).json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent to your email.',
      });
    } catch (error) {
      logger.error('Forgot password error:', error);
      // Avoid revealing if email exists
      res.status(200).json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent to your email.'
      });
    }
  }

  /**
   * Reset password using a token received via email link
   * @route POST /auth/reset-password
   */
  static async resetPasswordWithToken(req: Request, res: Response): Promise<void> {
    try {
      const { token, newPassword } = req.body;

      // Basic validation
      if (!token || !newPassword) {
        res.status(400).json({ success: false, message: 'Token and new password are required.' });
        return;
      }

      // Add password complexity validation here if needed
      // e.g., if (newPassword.length < 8) { ... }

      // Call AuthService to handle the logic
      await AuthService.resetPassword(token, newPassword);

      res.status(200).json({
        success: true,
        message: 'Your password has been reset successfully.',
      });
    } catch (error) {
      logger.error('Reset password with token error:', error);
      // Use isAppError or check specific error types (like AuthenticationError)
      const statusCode = isAppError(error) ? error.statusCode : 400; // Default to 400 for bad token/request
      const message = error instanceof Error ? error.message : 'Failed to reset password.';

      res.status(statusCode).json({
        success: false,
        message: message
      });
    }
  }

  // Remove or comment out the old resetPassword method if it's no longer used
  /*
  static async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const { email, otp, newPassword } = req.body;
      if (!email || !otp || !newPassword) {
        res.status(400).json({ success: false, message: 'Email, OTP, and new password are required' });
        return;
      }

      // Call AuthService to handle the logic
      await AuthService.resetPasswordWithOTP(email, otp, newPassword);

      res.status(200).json({ success: true, message: 'Password has been reset successfully.' });
    } catch (error) {
      logger.error('Reset password error:', error);
      const statusCode = isAppError(error) ? error.statusCode : 400;
      res.status(statusCode).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to reset password',
      });
    }
  }
  */
}
