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

    // Check for proxy configuration
    const proxyUrl = process.env.HTTP_PROXY || process.env.HTTPS_PROXY || null;

    // Define the type for our HTTP options
    interface HttpOptions {
      timeout: number;
      retry: boolean;
      maxRetries: number;
      retryDelay: number;
      keepAlive: boolean;
      dns: {
        family: number;
        hints: number;
      };
      proxy?: {
        host: string;
        port: number;
        protocol: string;
      };
    }

    // Configure network settings with proper typing
    const httpOptions: HttpOptions = {
      timeout: 30000, // 30 seconds timeout (increased from 10s)
      retry: true,    // Enable retries
      maxRetries: 5,  // Maximum number of retries
      retryDelay: 1000, // Delay between retries in ms
      keepAlive: true, // Keep connection alive
      dns: {
        family: 4,    // Use IPv4 (more compatible in some environments)
        hints: 0      // No special DNS hints
      }
    };

    // Add proxy configuration if available
    if (proxyUrl) {
      try {
        const proxyUrlObj = new URL(proxyUrl);
        httpOptions.proxy = {
          host: proxyUrlObj.hostname,
          port: parseInt(proxyUrlObj.port, 10) || (proxyUrlObj.protocol === 'https:' ? 443 : 80),
          protocol: proxyUrlObj.protocol.replace(':', '')
        };
        logger.info(`Using proxy for OAuth requests: ${proxyUrlObj.hostname}:${proxyUrlObj.port}`);
      } catch (error) {
        logger.error(`Invalid proxy URL format: ${proxyUrl}`, error);
      }
    }

    // Create OAuth2 client with standard parameters (no extra options)
    // The OAuth2 constructor only accepts 3 parameters in this version
    const oauth2Client = new OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    // Log the OAuth2 client configuration for debugging
    logger.info('Created OAuth2 client with enhanced network config:', {
      clientId: clientId.substring(0, 5) + '...',
      redirectUri,
      timeout: httpOptions.timeout,
      retry: httpOptions.retry,
      maxRetries: httpOptions.maxRetries,
      useProxy: !!proxyUrl
    });

    return oauth2Client;
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

      // Exchange the authorization code for tokens with fallback mechanism
      let tokens;
      try {
        logger.info('Attempting to exchange authorization code for tokens...');
        const tokenResponse = await oauth2Client.getToken(code);
        tokens = tokenResponse.tokens;

        if (!tokens || !tokens.access_token) {
          throw new Error('No access token in response');
        }

        logger.info('Successfully obtained tokens from Google');
      } catch (error) {
        // Type assertion for the error
        const tokenError = error as Error;
        logger.error('Error exchanging code for tokens:', tokenError);

        // Try alternative approach with direct fetch
        logger.info('Attempting fallback token exchange method...');
        try {
          const tokenUrl = 'https://oauth2.googleapis.com/token';
          const params = new URLSearchParams({
            code,
            client_id: process.env.GOOGLE_CLIENT_ID || '',
            client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
            redirect_uri: process.env.GOOGLE_REDIRECT_URI || '',
            grant_type: 'authorization_code'
          });

          // Add timeout to the fetch request
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

          const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'User-Agent': 'MyPTS-OAuth-Client/1.0'
            },
            body: params.toString(),
            signal: controller.signal
          });

          // Clear the timeout
          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
          }

          // Parse the response and add type assertion for TypeScript
          const tokenData = await response.json() as {
            access_token: string;
            refresh_token?: string;
            expires_in: number;
            token_type: string;
            id_token?: string;
          };

          // Create tokens object with proper type checking
          tokens = {
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token || undefined,
            expiry_date: new Date().getTime() + (tokenData.expires_in * 1000),
            token_type: tokenData.token_type,
            id_token: tokenData.id_token || undefined
          };

          logger.info('Successfully obtained tokens using fallback method');
        } catch (error) {
          // Type assertion for the fallback error
          const fallbackError = error as Error;
          logger.error('Fallback token exchange also failed:', fallbackError);

          // Create error message with proper error handling
          const tokenErrorMsg = tokenError?.message || 'Unknown token error';
          const fallbackErrorMsg = fallbackError?.message || 'Unknown fallback error';

          throw new Error(`Failed to obtain access token: ${tokenErrorMsg}. Fallback also failed: ${fallbackErrorMsg}`);
        }
      }

      if (!tokens || !tokens.access_token) {
        throw new Error('Failed to obtain access token from Google after all attempts');
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

          // Check URL for referral code
          let referralCode = '';
          try {
            const url = new URL(req.url || '', `http://${req.headers.host}`);
            referralCode = url.searchParams.get('ref') || '';
            logger.info(`Found referral code in URL: ${referralCode}`);

            // Also check for referral code in state parameter
            if (!referralCode && state && state.includes('ref=')) {
              const refMatch = state.match(/ref=([^&]+)/);
              if (refMatch && refMatch[1]) {
                referralCode = refMatch[1];
                logger.info(`Found referral code in state parameter: ${referralCode}`);
              }
            }
          } catch (urlError) {
            logger.error('Error extracting referral code from URL:', urlError);
          }

          // Create a new user with required fields
          logger.info(`Creating new user with referral code: ${referralCode}`);
          user = new User({
            googleId: profile.id,
            email: profile.email,
            fullName: profile.name,
            username,
            signupType: 'google',
            isEmailVerified: true,
            profileImage: profile.picture,
            // Store referral code temporarily for profile creation
            // We use tempReferralCode to avoid conflicts with existing codes
            tempReferralCode: referralCode || undefined,
            // Set these fields to undefined to avoid validation errors
            // They will be collected in the complete-profile page
            dateOfBirth: undefined,
            countryOfResidence: undefined,
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
            const profile = await profileService.createDefaultProfile(user._id.toString(), user);
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
        { expiresIn: '4h' } // Extended from 1h to 4h for better user experience
      );

      const refreshToken = jwt.sign(
        {
          userId: user._id,
          email: user.email,
          profileId: user.profileId || user.profiles?.[0]?.toString(), // Include profile ID in token
          type: 'refresh'
        },
        process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key',
        { expiresIn: '30d' } // Extended from 7d to 30d for consistency with other refresh tokens
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
        maxAge: 4 * 60 * 60 * 1000, // 4 hours (extended from 1 hour)
        path: '/',
      });

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days (extended from 7 days)
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
          dateOfBirth: user.dateOfBirth, // Include date of birth
          countryOfResidence: user.countryOfResidence, // Include country of residence
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
