import { Request, Response } from 'express';
import { google } from 'googleapis';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { logger } from '../utils/logger';

// Create OAuth2 client
const OAuth2 = google.auth.OAuth2;

/**
 * Social Authentication Controller
 * Handles authentication with various social providers (Google, Facebook, etc.)
 */
export class SocialAuthController {
  /**
   * Initialize the OAuth2 client with the provided credentials
   * @returns OAuth2 client instance
   */
  private static getOAuth2Client() {
    // Get environment variables
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Missing Google OAuth credentials in environment variables');
    }

    return new OAuth2(clientId, clientSecret, redirectUri);
  }

  /**
   * Redirect to Google's OAuth2 consent screen
   */
  static async googleLogin(req: Request, res: Response) {
    try {
      // Get the frontend callback URL from query parameters
      const frontendCallback = req.query.callback_url as string;
      const state = req.query.state as string || '';

      // Create a state parameter that includes the frontend callback URL
      const stateParam = frontendCallback
        ? `${state || 'default'}|${encodeURIComponent(frontendCallback)}`
        : state;

      // Get OAuth2 client
      const oauth2Client = SocialAuthController.getOAuth2Client();

      // Verify the OAuth2 client object seems valid before proceeding
      if (!oauth2Client || typeof oauth2Client.generateAuthUrl !== 'function') {
        logger.error('Invalid OAuth2 client obtained.');
        throw new Error('Failed to get a valid OAuth2 client instance.');
      }
      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: [
          'https://www.googleapis.com/auth/userinfo.profile',
          'https://www.googleapis.com/auth/userinfo.email'
        ],
        state: stateParam,
        prompt: 'consent' // Force consent screen to appear every time
      });

      logger.info(`Redirecting to Google consent screen with state: ${stateParam}`);
      res.redirect(authUrl);
    } catch (error) {
      logger.error('Error initiating Google login:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to initiate Google login',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Handle Google OAuth callback
   */
  static async googleCallback(req: Request, res: Response) {
    try {
      // Get the authorization code from the query parameters
      const code = req.query.code as string;

      // Get the state parameter
      const state = req.query.state as string || '';

      if (!code) {
        return res.status(400).json({
          success: false,
          message: 'Authorization code is required'
        });
      }

      logger.info(`Received Google callback with code: ${code.substring(0, 10)}...`);

      // Extract frontend callback URL from state parameter
      let frontendCallback = process.env.FRONTEND_URL || 'http://localhost:3001';
      let originalState = state;

      if (state && state.includes('|')) {
        const parts = state.split('|');
        originalState = parts[0];
        try {
          frontendCallback = decodeURIComponent(parts[1]);
          logger.info(`Extracted frontend callback from state: ${frontendCallback}`);
        } catch (error) {
          logger.error('Error decoding frontend callback URL:', error);
        }
      }

      // Get OAuth2 client
      const oauth2Client = SocialAuthController.getOAuth2Client();

      // Exchange the authorization code for tokens
      const { tokens } = await oauth2Client.getToken(code);

      if (!tokens.access_token) {
        throw new Error('Failed to obtain access token from Google');
      }

      // Fetch user profile using the access token
      const { data: profile } = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` }
      });

      logger.info(`Retrieved Google profile for user: ${profile.email}`);

      // Find or create user in the database
      let user = await User.findOne({ googleId: profile.id });

      if (!user) {
        // Check if user exists with the same email
        user = await User.findOne({ email: profile.email });

        if (user) {
          // Link Google account to existing user
          user.googleId = profile.id;
          user.isEmailVerified = true;
          if (!user.profileImage && profile.picture) {
            user.profileImage = profile.picture;
          }
          await user.save();
          logger.info(`Linked Google account to existing user: ${user.email}`);
        } else {
          // Create a new user
          const username = await SocialAuthController.generateUniqueUsername(profile.name || profile.email.split('@')[0]);

          // Create a new user with required fields
          user = new User({
            googleId: profile.id,
            email: profile.email,
            fullName: profile.name,
            username,
            signupType: 'google',
            isEmailVerified: true,
            profileImage: profile.picture,
            // Add required fields with default values
            dateOfBirth: new Date('1990-01-01'), // Default date of birth
            countryOfResidence: 'United States', // Default country
            phoneNumber: '', // Empty phone number
            accountType: 'MYSELF', // Default account type
            accountCategory: 'PRIMARY_ACCOUNT', // Default account category
            verificationMethod: 'EMAIL', // Default verification method
            password: await SocialAuthController.generateRandomPassword() // Generate a random password
          });

          await user.save();
          logger.info(`Created new user from Google login: ${user.email}`);

          // Create a default profile for the new user
          try {
            const { ProfileService } = require('../services/profile.service');
            const profileService = new ProfileService();
            const profile = await profileService.createDefaultProfile(user._id.toString());
            logger.info(`Default profile created for new Google user ${user._id}: ${profile._id}`);

            // Update user with profile ID
            user.profileId = profile._id.toString();
            user.profiles = [profile._id];
            await user.save();
          } catch (profileError) {
            logger.error(`Error creating default profile for Google user ${user._id}:`, profileError);
          }
        }
      }

      // Generate JWT tokens with profile ID
      const accessToken = jwt.sign(
        {
          userId: user._id,
          email: user.email,
          profileId: user.profileId || user.profiles?.[0]?.toString() // Include profile ID in token
        },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '1h' }
      );

      const refreshToken = jwt.sign(
        {
          userId: user._id,
          email: user.email,
          profileId: user.profileId || user.profiles?.[0]?.toString(), // Include profile ID in token
          type: 'refresh'
        },
        process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key',
        { expiresIn: '7d' }
      );

      // Store refresh token
      if (!user.refreshTokens) {
        user.refreshTokens = [];
      }
      user.refreshTokens.push(refreshToken);
      await user.save();

      // Set tokens in cookies
      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 1000, // 1 hour
        path: '/',
      });

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/',
      });

      // Construct the callback URL
      const callbackPath = '/auth/google/callback';
      const fullCallbackUrl = frontendCallback.endsWith(callbackPath)
        ? frontendCallback
        : `${frontendCallback}${callbackPath}`;

      // Redirect to frontend with success
      const redirectUrl = originalState && originalState !== 'default'
        ? `${fullCallbackUrl}?success=true&provider=google&token=${accessToken}&state=${originalState}`
        : `${fullCallbackUrl}?success=true&provider=google&token=${accessToken}`;

      logger.info(`Redirecting to frontend: ${redirectUrl}`);
      res.redirect(redirectUrl);
    } catch (error) {
      logger.error('Google authentication failed:', error);

      // Extract frontend callback from state
      let frontendCallback = process.env.FRONTEND_URL || 'http://localhost:3001';
      let originalState = req.query.state as string || '';

      if (originalState && originalState.includes('|')) {
        const parts = originalState.split('|');
        originalState = parts[0];
        try {
          frontendCallback = decodeURIComponent(parts[1]);
        } catch (e) {
          logger.error('Error decoding frontend callback URL:', e);
        }
      }

      // Construct the callback URL
      const callbackPath = '/auth/google/callback';
      const fullCallbackUrl = frontendCallback.endsWith(callbackPath)
        ? frontendCallback
        : `${frontendCallback}${callbackPath}`;

      // Get error message
      const errorMessage = error instanceof Error ? error.message : 'Google authentication failed';

      // Redirect to frontend with error
      const redirectUrl = originalState && originalState !== 'default'
        ? `${fullCallbackUrl}?error=${encodeURIComponent(errorMessage)}&state=${originalState}`
        : `${fullCallbackUrl}?error=${encodeURIComponent(errorMessage)}`;

      logger.info(`Redirecting to frontend with error: ${redirectUrl}`);
      res.redirect(redirectUrl);
    }
  }

  /**
   * Generate a unique username based on the provided name
   */
  private static async generateUniqueUsername(baseName: string): Promise<string> {
    // Remove spaces and special characters
    let username = baseName.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Check if username exists
    let user = await User.findOne({ username });

    // If username exists, add a random number
    if (user) {
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      username = `${username}${randomSuffix}`;

      // Check again
      user = await User.findOne({ username });

      // If still exists, add timestamp
      if (user) {
        username = `${username}${Date.now().toString().slice(-4)}`;
      }
    }

    return username;
  }

  /**
   * Generate a random password for social login users
   * @returns A secure random password
   */
  private static async generateRandomPassword(): Promise<string> {
    // Generate a random string of 16 characters
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
    let password = '';

    for (let i = 0; i < 16; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      password += characters.charAt(randomIndex);
    }

    // Hash the password using bcrypt
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
  }

  /**
   * Get the current user's profile
   */
  static async getCurrentUser(req: Request, res: Response) {
    try {
      // Extract token from cookies or Authorization header
      const token = req.cookies.accessToken || req.header('Authorization')?.replace('Bearer ', '');

      if (!token) {
        return res.status(401).json({ success: false, message: 'No token provided' });
      }

      // Verify the token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as { userId: string };

      // Find the user
      const user = await User.findById(decoded.userId);

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Return user data with profile ID
      const profileId = user.profileId || (user.profiles && user.profiles.length > 0 ? user.profiles[0].toString() : null);

      // Log the profile ID for debugging
      logger.info(`User ${user._id} has profileId: ${profileId}`);

      res.json({
        success: true,
        user: {
          id: user._id,
          email: user.email,
          fullName: user.fullName,
          username: user.username,
          googleId: user.googleId,
          facebookId: user.facebookId,
          linkedinId: user.linkedinId,
          signupType: user.signupType,
          isEmailVerified: user.isEmailVerified,
          profileImage: user.profileImage,
          profileId: profileId, // Include profile ID in response
          profiles: user.profiles ? user.profiles.map(p => p.toString()) : [] // Include all profiles
        }
      });
    } catch (err) {
      logger.error('Token verification error:', err);
      res.status(401).json({ success: false, message: 'Invalid token' });
    }
  }
}
