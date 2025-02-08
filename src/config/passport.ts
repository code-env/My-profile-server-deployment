import passport from 'passport';
// import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
// import { Strategy as FacebookStrategy } from 'passport-facebook';
import { User } from '../models/User';
import { config } from './config';
import { logger } from '../utils/logger';

// Social authentication strategies temporarily disabled

// Google OAuth Strategy
/*
passport.use(
  new GoogleStrategy(
    {
      clientID: config.GOOGLE_CLIENT_ID,
      clientSecret: config.GOOGLE_CLIENT_SECRET,
      callbackURL: `${config.API_URL}/auth/google/callback`,
      scope: ['profile', 'email'],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ email: profile.emails?.[0]?.value });

        if (user) {
          // Link Google account if user exists
          user.googleId = profile.id;
          user.isEmailVerified = true;
          await user.save();
        } else {
          // Create new user if doesn't exist
          user = await User.create({
            email: profile.emails?.[0]?.value,
            firstName: profile.name?.givenName || '',
            lastName: profile.name?.familyName || '',
            password: Math.random().toString(36).slice(-8), // Random password
            googleId: profile.id,
            isEmailVerified: true,
          });
        }

        return done(null, user);
      } catch (error) {
        logger.error('Google auth error:', error);
        return done(error as Error);
      }
    }
  )
);
*/

// Facebook OAuth Strategy
/*
passport.use(
  new FacebookStrategy(
    {
      clientID: config.FACEBOOK_APP_ID,
      clientSecret: config.FACEBOOK_APP_SECRET,
      callbackURL: `${config.API_URL}/auth/facebook/callback`,
      profileFields: ['id', 'emails', 'name'],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ email: profile.emails?.[0]?.value });

        if (user) {
          // Link Facebook account if user exists
          user.facebookId = profile.id;
          user.isEmailVerified = true;
          await user.save();
        } else {
          // Create new user if doesn't exist
          user = await User.create({
            email: profile.emails?.[0]?.value,
            firstName: profile.name?.givenName || '',
            lastName: profile.name?.familyName || '',
            password: Math.random().toString(36).slice(-8), // Random password
            facebookId: profile.id,
            isEmailVerified: true,
          });
        }

        return done(null, user);
      } catch (error) {
        logger.error('Facebook auth error:', error);
        return done(error as Error);
      }
    }
  )
);
*/

// Serialize user for the session
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

// Deserialize user from the session
passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error);
  }
});

export default passport;
