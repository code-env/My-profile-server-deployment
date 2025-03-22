import { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { User, IUser } from '../models/User';
import jwt from 'jsonwebtoken';

// Configure Google Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: "124684938199-e7ocs5m4npm1hm31i5e0j5sbqk9m62m9.apps.googleusercontent.com",
      clientSecret: "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",
      callbackURL: "https://friendly-memory-v5rv64x7jrj2jv7-5000.app.github.dev/api/sauth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Find or create the user in your database
        let user = await User.findOne({ googleId: profile.id });
        console.log("user here:", user,profile.emails?.[0].value, profile.id, profile)

        if (!user) {
          user = await User.findOne({ email: profile.emails?.[0].value });

          if (user) {
            // Link the Google account to the existing user
            user.googleId = profile.id;
            user.signupType = 'google';
            await user.save();
          } else {
            // Create a new user
            user = new User({
              googleId: profile.id,
              email: profile.emails?.[0].value,
              fullName: profile.displayName,
              username: profile.emails?.[0].value.split('@')[0],
              signupType: 'google',
              isEmailVerified: true,
              password: 'oauth2-user-no-password',
              dateOfBirth: new Date(),
              countryOfResidence: 'Unknown',
              accountType: 'MYSELF',
              accountCategory: 'PRIMARY_ACCOUNT', 
              verificationMethod: 'EMAIL',
              profileImage:profile.photos?.[0].value,
            });
            await user.save();
          }
        }

        // Return the user
        done(null, user);
      } catch (err) {
        done(err, undefined);
      }
    }
  )
);

// Configure Facebook Strategy
passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_APP_ID!,
      clientSecret: process.env.FACEBOOK_APP_SECRET!,
      callbackURL: process.env.FACEBOOK_REDIRECT_URI!,
      profileFields: ['id', 'emails', 'name', 'displayName'], // Requested fields
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Find or create the user in your database
        let user = await User.findOne({ facebookId: profile.id });

        if (!user) {
          user = await User.findOne({ email: profile.emails?.[0].value });

          if (user) {
            // Link the Facebook account to the existing user
            user.facebookId = profile.id;
            user.signupType = 'facebook';
            await user.save();
          } else {
            // Create a new user
            user = new User({
              facebookId: profile.id,
              email: profile.emails?.[0].value,
              fullName: profile.displayName,
              username: profile.emails?.[0].value.split('@')[0],
              signupType: 'facebook',
              isEmailVerified: true,
            });
            await user.save();
          }
        }

        // Return the user
        done(null, user);
      } catch (err) {
        done(err, null);
      }
    }
  )
);

// Serialize user
passport.serializeUser((user: any, done) => {
  done(null, user._id);
});

// Deserialize user
passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

// Google OAuth2 consent screen
export const googleConsent = passport.authenticate('google', { scope: ['profile', 'email'] });

// Google OAuth2 callback
export const googleCallback = (req: Request, res: Response, next: NextFunction) => {

  passport.authenticate('google', (err: Error, user: IUser) => {
    if (err || !user) {
      return res.status(400).json({ error: 'Google authentication failed', message:err });
    }

    // Generate a JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: '1h' }
    );

    // Send the response
    res.json({ token, user });
  })(req, res, next);
};

// Facebook OAuth2 consent screen
export const facebookConsent = passport.authenticate('facebook', { scope: ['email'] });

// Facebook OAuth2 callback
export const facebookCallback = (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate('facebook', (err: Error, user: IUser) => {
    if (err || !user) {
      return res.status(400).json({ error: 'Facebook authentication failed' });
    }

    // Generate a JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: '1h' }
    );

    // Send the response
    res.json({ token, user });
  })(req, res, next);
};