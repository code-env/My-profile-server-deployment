import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { Strategy as LinkedInStrategy } from 'passport-linkedin-oauth2';
import { User } from '../models/User';
import { logger } from '../utils/logger';
import jwt, { SignOptions } from 'jsonwebtoken';
import { config } from '../config/config';

// Maximum number of refresh tokens to store per user
const MAX_REFRESH_TOKENS = 3;

// Generate access and refresh tokens
const generateTokens = (userId: string, email: string) => {
  const jwtSecret = process.env.JWT_SECRET || '';
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || '';

  // Use string literals instead of config values to avoid type errors
  const accessTokenOptions: SignOptions = {
    expiresIn: "4h" // Extended from 1h to 4h for better user experience
  };

  const refreshTokenOptions: SignOptions = {
    expiresIn: "30d" // Same as config.JWT_REFRESH_EXPIRATION
  };

  const accessToken = jwt.sign(
    { userId, email },
    jwtSecret,
    accessTokenOptions
  );

  const refreshToken = jwt.sign(
    { userId, email, type: 'refresh' },
    jwtRefreshSecret,
    refreshTokenOptions
  );

  return { accessToken, refreshToken };
};

// Types for passport callbacks
interface AuthUserResult {
  user: any;
  accessToken: string;
  refreshToken: string;
}

// Google OAuth Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      callbackURL: `${config.BASE_URL}/api/auth/google/callback`,
      scope: ['profile', 'email'],
    },
    async (_accessToken: string, _refreshToken: string, profile: any, done: (error: Error | null, user?: any) => void) => {
      try {
        logger.info('Google authentication attempt:', { profileId: profile.id });

        // First try to find user by googleId
        let user = await User.findOne({ googleId: profile.id });

        if (!user && profile.emails && profile.emails.length > 0) {
          // If not found by googleId, try to find by email
          user = await User.findOne({ email: profile.emails[0].value });

          if (user) {
            // Link Google account to existing user
            user.googleId = profile.id;
            user.signupType = 'google';
            user.isEmailVerified = true;
            await user.save();
            logger.info('Linked Google account to existing user', { userId: user.id });
          } else {
            // Create new user
            const username = profile.emails[0].value.split('@')[0];

            user = new User({
              googleId: profile.id,
              email: profile.emails[0].value,
              fullName: profile.displayName,
              username: username,
              signupType: 'google',
              isEmailVerified: true,
              password: 'oauth2-user-no-password', // This will be hashed by the User model
              // Set these fields to undefined to avoid validation errors
              // They will be collected in the complete-profile page
              dateOfBirth: undefined,
              countryOfResidence: undefined,
              phoneNumber: undefined, // Will be collected in profile completion,
              accountType: 'MYSELF',
              accountCategory: 'PRIMARY_ACCOUNT',
              verificationMethod: 'EMAIL',
              profileImage: profile.photos?.[0]?.value,
              refreshTokens: [],
            });

            await user.save();
            logger.info('Created new user from Google authentication', { userId: user.id });
          }
        }

        if (!user) {
          logger.error('Failed to create or find user from Google profile');
          return done(new Error('Could not create or find user'));
        }

        // Generate tokens
        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = generateTokens(user.id.toString(), user.email);

        // Store refresh token (limit the number of tokens)
        if (user.refreshTokens.length >= MAX_REFRESH_TOKENS) {
          // Remove the oldest token
          user.refreshTokens = user.refreshTokens.slice(-MAX_REFRESH_TOKENS + 1);
        }
        user.refreshTokens.push(newRefreshToken);
        await user.save();

        const result: AuthUserResult = {
          user: user.toObject(),
          accessToken: newAccessToken,
          refreshToken: newRefreshToken
        };

        return done(null, result);
      } catch (error) {
        logger.error('Google auth error:', error);
        return done(error as Error);
      }
    }
  )
);

// Facebook OAuth Strategy
passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_APP_ID || '',
      clientSecret: process.env.FACEBOOK_APP_SECRET || '',
      callbackURL: `${config.BASE_URL}/api/auth/facebook/callback`,
      profileFields: ['id', 'emails', 'name', 'displayName', 'photos'],
    },
    async (_accessToken: string, _refreshToken: string, profile: any, done: (error: Error | null, user?: any) => void) => {
      try {
        logger.info('Facebook authentication attempt:', { profileId: profile.id });

        // First try to find user by facebookId
        let user = await User.findOne({ facebookId: profile.id });

        if (!user && profile.emails && profile.emails.length > 0) {
          // If not found by facebookId, try to find by email
          user = await User.findOne({ email: profile.emails[0].value });

          if (user) {
            // Link Facebook account to existing user
            user.facebookId = profile.id;
            user.signupType = 'facebook';
            user.isEmailVerified = true;
            await user.save();
            logger.info('Linked Facebook account to existing user', { userId: user.id });
          } else {
            // Create new user
            const username = profile.emails[0].value.split('@')[0];

            user = new User({
              facebookId: profile.id,
              email: profile.emails[0].value,
              fullName: profile.displayName,
              username: username,
              signupType: 'facebook',
              isEmailVerified: true,
              password: 'oauth2-user-no-password', // This will be hashed by the User model
              dateOfBirth: new Date(),
              countryOfResidence: 'Unknown',
              accountType: 'MYSELF',
              accountCategory: 'PRIMARY_ACCOUNT',
              verificationMethod: 'EMAIL',
              profileImage: profile.photos?.[0]?.value,
              refreshTokens: [],
            });

            await user.save();
            logger.info('Created new user from Facebook authentication', { userId: user.id });
          }
        }

        if (!user) {
          logger.error('Failed to create or find user from Facebook profile');
          return done(new Error('Could not create or find user'));
        }

        // Generate tokens
        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = generateTokens(user.id.toString(), user.email);

        // Store refresh token (limit the number of tokens)
        if (user.refreshTokens.length >= MAX_REFRESH_TOKENS) {
          // Remove the oldest token
          user.refreshTokens = user.refreshTokens.slice(-MAX_REFRESH_TOKENS + 1);
        }
        user.refreshTokens.push(newRefreshToken);
        await user.save();

        const result: AuthUserResult = {
          user: user.toObject(),
          accessToken: newAccessToken,
          refreshToken: newRefreshToken
        };

        return done(null, result);
      } catch (error) {
        logger.error('Facebook auth error:', error);
        return done(error as Error);
      }
    }
  )
);

// LinkedIn OAuth Strategy
// Use a separate options object to avoid TypeScript errors
const linkedInOptions = {
  clientID: process.env.LINKEDIN_CLIENT_ID || '',
  clientSecret: process.env.LINKEDIN_CLIENT_SECRET || '',
  callbackURL: `${config.BASE_URL}/api/auth/linkedin/callback`,
  scope: ['r_emailaddress', 'r_liteprofile'],
  state: true
};

passport.use(
  // @ts-ignore - Ignore type checking for this strategy
  new LinkedInStrategy(
    linkedInOptions,
    async (_accessToken: string, _refreshToken: string, profile: any, done: (error: Error | null, user?: any) => void) => {
      try {
        logger.info('LinkedIn authentication attempt:', { profileId: profile.id });

        // First try to find user by linkedinId
        let user = await User.findOne({ linkedinId: profile.id });

        if (!user && profile.emails && profile.emails.length > 0) {
          // If not found by linkedinId, try to find by email
          user = await User.findOne({ email: profile.emails[0].value });

          if (user) {
            // Link LinkedIn account to existing user
            user.linkedinId = profile.id;
            user.signupType = 'linkedin';
            user.isEmailVerified = true;
            await user.save();
            logger.info('Linked LinkedIn account to existing user', { userId: user.id });
          } else {
            // Create new user
            const username = profile.emails[0].value.split('@')[0];

            user = new User({
              linkedinId: profile.id,
              email: profile.emails[0].value,
              fullName: profile.displayName,
              username: username,
              signupType: 'linkedin',
              isEmailVerified: true,
              password: 'oauth2-user-no-password', // This will be hashed by the User model
              dateOfBirth: new Date(),
              countryOfResidence: 'Unknown',
              accountType: 'MYSELF',
              accountCategory: 'PRIMARY_ACCOUNT',
              verificationMethod: 'EMAIL',
              profileImage: profile.photos?.[0]?.value,
              refreshTokens: [],
            });

            await user.save();
            logger.info('Created new user from LinkedIn authentication', { userId: user.id });
          }
        }

        if (!user) {
          logger.error('Failed to create or find user from LinkedIn profile');
          return done(new Error('Could not create or find user'));
        }

        // Generate tokens
        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = generateTokens(user.id.toString(), user.email);

        // Store refresh token (limit the number of tokens)
        if (user.refreshTokens.length >= MAX_REFRESH_TOKENS) {
          // Remove the oldest token
          user.refreshTokens = user.refreshTokens.slice(-MAX_REFRESH_TOKENS + 1);
        }
        user.refreshTokens.push(newRefreshToken);
        await user.save();

        const result: AuthUserResult = {
          user: user.toObject(),
          accessToken: newAccessToken,
          refreshToken: newRefreshToken
        };

        return done(null, result);
      } catch (error) {
        logger.error('LinkedIn auth error:', error);
        return done(error as Error);
      }
    }
  )
);

// Serialize user for the session
passport.serializeUser((user: any, done) => {
  done(null, user.id || user.user?.id);
});

// Deserialize user from the session
passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

export { generateTokens };
export default passport;
