import { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { User, IUser } from '../models/User';
import * as jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';
import { OAuth2Client } from 'google-auth-library';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const googleMobileCallback = async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ error: 'idToken is required' });

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: "124684938199-e7ocs5m4npm1hm31i5e0j5sbqk9m62m9.apps.googleusercontent.com",
    });

    const payload = ticket.getPayload();
    if (!payload) return res.status(401).json({ error: 'Invalid ID token' });

    let user = await User.findOne({ email: payload.email });
    if (!user) {
      user = new User({
        googleId: payload.sub,
        email: payload.email,
        fullName: payload.name,
        username: payload.email?.split('@')[0],
        signupType: 'google',
        isEmailVerified: true,
        profileImage: payload.picture,
        refreshTokens: [],
      });
      await user.save();
    }

    const { accessToken, refreshToken } = generateTokens(user.id.toString(), user.email);
    user.refreshTokens.push(refreshToken);
    await user.save();

    res.json({ accessToken, refreshToken, user });
  } catch (err: any) {
    logger.error('Google Mobile authentication failed:', err);
    res.status(401).json({ error: 'Google authentication failed', message: err.message });
  }
};


passport.use(
  new GoogleStrategy(
    {
      clientID: "124684938199-e7ocs5m4npm1hm31i5e0j5sbqk9m62m9.apps.googleusercontent.com",
      clientSecret: "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",
      callbackURL: "https://friendly-memory-v5rv64x7jrj2jv7-5000.app.github.dev/api/sauth/google/callback"
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ googleId: profile.id });

        if (!user) {
          user = await User.findOne({ email: profile.emails?.[0].value });

          if (user) {
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
              profileImage: profile.photos?.[0].value,
              refreshTokens: [],
            });
            await user.save();
          }
        }

        // Generate access and refresh tokens
        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = generateTokens(user.id.toString(), user.email);

        // Store the refresh token in the user's document
        user.refreshTokens.push(newRefreshToken);
        await user.save();

        done(null, { ...user.toObject() as any, accessToken: newAccessToken, refreshToken: newRefreshToken });
      } catch (err) {
        logger.error('Google authentication failed:', err);
        done(err, undefined);
      }
    }
  )
);


passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_APP_ID!,
      clientSecret: process.env.FACEBOOK_APP_SECRET!,
      callbackURL: process.env.FACEBOOK_REDIRECT_URI!,
      profileFields: ['id', 'emails', 'name', 'displayName'],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ facebookId: profile.id });

        if (!user) {
          user = await User.findOne({ email: profile.emails?.[0].value });

          if (user) {
            user.facebookId = profile.id;
            user.signupType = 'facebook';
            await user.save();
          } else {
            user = new User({
              facebookId: profile.id,
              email: profile.emails?.[0].value,
              fullName: profile.displayName,
              username: profile.emails?.[0].value.split('@')[0],
              signupType: 'facebook',
              isEmailVerified: true,
              password: 'oauth2-user-no-password',
              dateOfBirth: new Date(),
              countryOfResidence: 'Unknown',
              accountType: 'MYSELF',
              accountCategory: 'PRIMARY_ACCOUNT',
              verificationMethod: 'EMAIL',
              refreshTokens: [],
            });
            await user.save();
          }
        }


        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = generateTokens(user.id.toString(), user.email);


        user.refreshTokens.push(newRefreshToken);
        await user.save();


        done(null, { user, accessToken: newAccessToken, refreshToken: newRefreshToken });
      } catch (err) {
        logger.error('Facebook authentication failed:', err);
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

// Generate access and refresh tokens
const generateTokens = (userId: string, email: string) => {
  const accessToken = (jwt as any).sign({ userId, email }, process.env.JWT_SECRET!, {
    expiresIn: '1h',
  });

  const refreshToken = (jwt as any).sign(
    { userId, email, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: '7d' } // Long-lived refresh token
  );

  return { accessToken, refreshToken };
};


const refreshAccessToken = async (refreshToken: string) => {
  try {
    const decoded = (jwt as any).verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as {
      userId: string;
      email: string;
      type: string;
    };

    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }


    const user = await User.findById(decoded.userId);
    if (!user || !user.refreshTokens?.includes(refreshToken)) {
      throw new Error('Invalid refresh token');
    }


    const newRefreshToken = jwt.sign(
      { userId: user.id.toString(), email: user.email, type: 'refresh' },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: '7d' }
    );

    const accessToken = jwt.sign(
      { userId: user.id.toString(), email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: '1h' }
    );

    user.refreshTokens = user.refreshTokens.filter((token) => token !== refreshToken);
    user.refreshTokens.push(newRefreshToken);
    await user.save();

    return { accessToken, refreshToken: newRefreshToken };
  } catch (err) {
    logger.error('Failed to refresh access token:', err);
    throw new Error('Failed to refresh access token');
  }
};

// Google OAuth2 consent screen
export const googleConsent = passport.authenticate('google', { scope: ['profile', 'email'] });




// Google OAuth2 callback
export const googleCallback = (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate('google', (err: Error, data: { user: IUser; accessToken: string; refreshToken: string }) => {
    if (err || !data) {
      return res.status(400).json({ error: 'Google authentication failed', message: err?.message });
    }


    res.json({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user });
  })(req, res, next);
};

// Facebook OAuth2 consent screen
export const facebookConsent = passport.authenticate('facebook', { scope: ['email'] });

// Facebook OAuth2 callback
export const facebookCallback = (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate('facebook', (err: Error, data: { user: IUser; accessToken: string; refreshToken: string }) => {
    if (err || !data) {
      return res.status(400).json({ error: 'Facebook authentication failed', message: err?.message });
    }


    res.json({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user });
  })(req, res, next);
};

export const refreshToken = async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token is required' });
  }

  try {
    const tokens = await refreshAccessToken(refreshToken);
    res.json(tokens);
  } catch (err:any) {
    res.status(401).json({ error: 'Failed to refresh token', message: err.message });
  }
};
