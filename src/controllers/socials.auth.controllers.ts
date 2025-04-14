import { Request, Response } from 'express';
import axios from 'axios';
import * as jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { logger } from '../utils/logger';
import { google } from 'googleapis';

const OAuth2 = google.auth.OAuth2;

// Determine the base URL based on environment
const BASE_URL = process.env.RENDER_NODE_ENV === 'true'
  ? 'https://my-profile-server-api.onrender.com'
  : 'http://localhost:3000';

const oauth2Client = new OAuth2(
  process.env.GOOGLE_CLIENT_ID || "94360662061-49htsukh1n89r38fjd5gmv5fekbu9ler.apps.googleusercontent.com",
  process.env.GOOGLE_CLIENT_SECRET || "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",
  process.env.G_REDIRECTURI || `${BASE_URL}/api/auth/google/callback`
);

export class AuthSocialController {
  // Redirect to Google's OAuth2 consent screen
  // static async googleConsent(req: Request, res: Response) {
  //   const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${process.env.GOOGLE_REDIRECT_URI}&response_type=code&scope=profile email`;
  //   res.redirect(url);
  // }

  // // Handle Google callback after consent
  // static async googleAuth(req: Request, res: Response) {
  //   const { code } = req.query;

  //   if (!code) {
  //     return res.status(400).json({ error: 'Authorization code is required' });
  //   }

  //   try {
  //     // Exchange the authorization code for an access token
  //     const { data } = await axios.post('https://oauth2.googleapis.com/token', {
  //       client_id: "124684938199-e7ocs5m4npm1hm31i5e0j5sbqk9m62m9.apps.googleusercontent.com",
  //       client_secret: "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",
  //       code,
  //       redirect_uri: process.env.GOOGLE_REDIRECT_URI,
  //       grant_type: 'authorization_code',
  //     });

  //     const { access_token } = data;

  //     // Fetch user profile using the access token
  //     const { data: profile } = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
  //       headers: { Authorization: `Bearer ${access_token}` },
  //     });

  //     // Find or create the user in your database
  //     let user = await User.findOne({ googleId: profile.id });

  //     if (!user) {
  //       user = await User.findOne({ email: profile.email });

  //       if (user) {
  //         // Link the Google account to the existing user
  //         user.googleId = profile.id;
  //         user.signupType = 'google';
  //         await user.save();
  //       } else {
  //         // Create a new user
  //         user = new User({
  //           googleId: profile.id,
  //           email: profile.email,
  //           fullName: profile.name,
  //           username: profile.email.split('@')[0],
  //           signupType: 'google',
  //           isEmailVerified: true,
  //         });
  //         await user.save();
  //       }
  //     }

  //     // Generate a JWT token
  //     const token = jwt.sign(
  //       { userId: user._id, email: user.email, role: user.role },
  //       process.env.JWT_SECRET!,
  //       { expiresIn: '1h' }
  //     );

  //     // Redirect to the frontend with the token and user data
  //     res.redirect(`${process.env.FRONTEND_REDIRECT_URI}?token=${token}&user=${JSON.stringify(user)}`);
  //   } catch (err) {
  //     logger.error('Google authentication failed:', err);
  //     res.status(500).json({ error: 'Google authentication failed' });
  //   }
  // }


  static async googleConsent(_req: Request, res: Response) {
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/userinfo.email'],
    });

    console.log("url here:", url);
    res.redirect(url);
  }

  // Handle Google callback after consent
  // static async googleAuth(req: Request, res: Response) {
  //   // const { code } = req.query;

  //   // if (!code) {
  //   //   return res.status(400).json({ error: 'Authorization code is required' });
  //   // }

  //   try {
  //     // Exchange the authorization code for tokens
  //     const { tokens } = await oauth2Client.getToken("4%2F0AQSTgQH0r9Ap7QylecMsGQSS8qKCHAmf1003s3zGGjzVm94fvGWKyYNVTVRaVHItyX9Gcw");
  //     oauth2Client.setCredentials(tokens);

  //     // Fetch user profile using the access token

  //     console.log("tokens here:", tokens);
  //     const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  //     const { data: profile } = await oauth2.userinfo.get();

  //     console.log("profile here:", profile);

  //     // Find or create the user in your database
  //     let user = await User.findOne({ googleId: profile.id });

  //     if (!user) {
  //       user = await User.findOne({ email: profile.email });

  //       if (user) {
  //         // Link the Google account to the existing user
  //         // user?.googleId = profile.id;
  //         user.signupType = 'google';
  //         await user.save();
  //       } else {
  //         // Create a new user
  //         user = new User({
  //           googleId: profile.id,
  //           email: profile.email,
  //           fullName: profile.name,
  //           username: "tester",
  //           signupType: 'google',
  //           isEmailVerified: true,
  //         });
  //         await user.save();
  //       }
  //     }

  //     // Generate a JWT token
  //     const token = jwt.sign(
  //       { userId: user._id, email: user.email, role: user.role },
  //       process.env.JWT_SECRET!,
  //       { expiresIn: '1h' }
  //     );

  //     // Redirect to the frontend with the token and user data
  //     res.redirect(`${process.env.FRONTEND_REDIRECT_URI}?token=${token}&user=${JSON.stringify(user)}`);
  //   } catch (err) {
  //     logger.error('Google authentication failed:', err);
  //     res.status(500).json({ error: 'Google authentication failed' });
  //   }
  // }

  static async googleAuth(req: Request, res: Response) {
    const { code } = req.body;
    // const code = "4%2F0AQSTgQGwG1pDh55Op3uvswJAgA_RUUOvvI_cuDPeiLDi7sqmvvpIWbOmrMFQD3ia_gq0tQ"

    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    try {
      // Exchange the authorization code for tokens
      const { data } = await axios.post('https://oauth2.googleapis.com/token', {
        client_id: process.env.GOOGLE_CLIENT_ID || "94360662061-49htsukh1n89r38fjd5gmv5fekbu9ler.apps.googleusercontent.com",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "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",
        code,
        redirect_uri: process.env.G_REDIRECTURI || `${BASE_URL}/api/auth/google/callback`,
        grant_type: 'authorization_code',
      });

      if(!data){
        res.status(200).json({message:"User created successfully insitue", data:data });
      }

      const { access_token } = data;

      // Fetch user profile using the access token
      const { data: profile } = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${access_token}` },
      });


      console.log("profile here:", profile);
      // Find or create the user in your database
      let user = await User.findOne({ googleId: profile.id });

      if (!user) {
        user = await User.findOne({ email: profile.email });

        if (user) {
          // Link the Google account to the existing user
          user.googleId = profile.id;
          user.signupType = 'google';
          await user.save();
        } else {
          // Create a new user
          user = new User({
            googleId: profile.id,
            email: profile.email,
            fullName: profile.name,
            username: profile.email.split('@')[0],
            signupType: 'google',
            isEmailVerified: true,
          });
          await user.save();
        }
      }

      // Generate a JWT token
      /* Uncomment if you need to use the token
      const token = jwt.sign(
        { userId: user._id, email: user.email, role: user.role },
        process.env.JWT_SECRET!,
        { expiresIn: '1h' }
      );
      */

      // Generate tokens
      const accessToken = jwt.sign(
        { userId: user._id, email: user.email },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '1h' }
      );

      const refreshToken = jwt.sign(
        { userId: user._id, email: user.email, type: 'refresh' },
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
        secure: process.env.RENDER_NODE_ENV === 'true',
        maxAge: 60 * 60 * 1000, // 1 hour
        path: '/',
      });

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.RENDER_NODE_ENV === 'true',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/',
      });

      // Redirect to frontend with success
      res.redirect(`/socials?success=true&provider=google&token=${accessToken}`);
    } catch (err) {
      // logger.error('Google authentication failed:', err);

      res.status(500).json({ error: 'Google authentication failed here', errors:err });
    }
  }

  // Redirect to Facebook's OAuth2 consent screen
  static async facebookConsent(_req: Request, res: Response) {
    const redirectUri = process.env.FACEBOOK_REDIRECT_URI || `${BASE_URL}/api/sauth/facebook/callback`;
    const url = `https://www.facebook.com/v12.0/dialog/oauth?client_id=${process.env.FACEBOOK_APP_ID}&redirect_uri=${redirectUri}&scope=email`;
    res.redirect(url);
  }

  // Handle Facebook callback after consent
  static async facebookAuth(req: Request, res: Response) {
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    try {
      // Exchange the authorization code for an access token
      const { data } = await axios.get('https://graph.facebook.com/v12.0/oauth/access_token', {
        params: {
          client_id: process.env.FACEBOOK_APP_ID,
          client_secret: process.env.FACEBOOK_APP_SECRET,
          redirect_uri: process.env.FACEBOOK_REDIRECT_URI || `${BASE_URL}/api/sauth/facebook/callback`,
          code,
        },
      });

      const { access_token } = data;

      // Fetch user profile using the access token
      const { data: profile } = await axios.get('https://graph.facebook.com/v12.0/me', {
        params: {
          fields: 'id,name,email',
          access_token,
        },
      });

      // Find or create the user in your database
      let user = await User.findOne({ facebookId: profile.id });

      if (!user) {
        user = await User.findOne({ email: profile.email });

        if (user) {
          // Link the Facebook account to the existing user
          user.facebookId = profile.id;
          user.signupType = 'facebook';
          await user.save();
        } else {
          // Create a new user
          user = new User({
            facebookId: profile.id,
            email: profile.email,
            fullName: profile.name,
            username: profile.email.split('@')[0],
            signupType: 'facebook',
            isEmailVerified: true,
          });
          await user.save();
        }
      }

      // Generate a JWT token
      const token = jwt.sign(
        { userId: user._id, email: user.email, role: user.role },
        process.env.JWT_SECRET!,
        { expiresIn: '1h' }
      );

      // Redirect to the frontend with the token and user data
      res.status(200).json({message:"User created successfully", token, user });
    } catch (err) {
      logger.error('Facebook authentication failed:', err);
      res.status(500).json({ error: 'Facebook authentication failed' });
    }
  }

  // LinkedIn OAuth methods
  static async linkedinConsent(_req: Request, res: Response) {
    try {
      // Replace with your LinkedIn app credentials
      const clientId = process.env.LINKEDIN_CLIENT_ID || 'your_linkedin_client_id';
      const redirectUri = process.env.LINKEDIN_REDIRECT_URI || `${BASE_URL}/api/sauth/linkedin/callback`;

      // Construct the LinkedIn authorization URL
      const url = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=r_liteprofile%20r_emailaddress`;

      // Redirect the user to LinkedIn's authorization page
      res.redirect(url);
    } catch (error) {
      logger.error('LinkedIn consent error:', error);
      res.status(500).json({ error: 'Failed to redirect to LinkedIn' });
    }
  }

  static async linkedinAuth(req: Request, res: Response) {
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    try {
      // Replace with your LinkedIn app credentials
      const clientId = process.env.LINKEDIN_CLIENT_ID || 'your_linkedin_client_id';
      const clientSecret = process.env.LINKEDIN_CLIENT_SECRET || 'your_linkedin_client_secret';
      const redirectUri = process.env.LINKEDIN_REDIRECT_URI || `${BASE_URL}/api/sauth/linkedin/callback`;

      // Exchange the authorization code for an access token
      const tokenResponse = await axios.post('https://www.linkedin.com/oauth/v2/accessToken',
        `grant_type=authorization_code&code=${code}&redirect_uri=${encodeURIComponent(redirectUri)}&client_id=${clientId}&client_secret=${clientSecret}`,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      const { access_token } = tokenResponse.data;

      // Get user profile information
      const profileResponse = await axios.get('https://api.linkedin.com/v2/me', {
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'cache-control': 'no-cache',
          'X-Restli-Protocol-Version': '2.0.0'
        }
      });

      // Get user email address
      const emailResponse = await axios.get('https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))', {
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'cache-control': 'no-cache',
          'X-Restli-Protocol-Version': '2.0.0'
        }
      });

      const profileData = profileResponse.data;
      const emailData = emailResponse.data.elements[0]['handle~'].emailAddress;

      // Find or create user
      let user = await User.findOne({ linkedinId: profileData.id });

      if (!user) {
        // Check if user exists with this email
        user = await User.findOne({ email: emailData });

        if (user) {
          // Link LinkedIn account to existing user
          user.linkedinId = profileData.id;
          await user.save();
        } else {
          // Create new user
          user = new User({
            linkedinId: profileData.id,
            email: emailData,
            fullName: `${profileData.localizedFirstName} ${profileData.localizedLastName}`,
            username: emailData.split('@')[0],
            password: Math.random().toString(36).slice(-8), // Random password
            signupType: 'linkedin',
            isEmailVerified: true,
            dateOfBirth: new Date(),
            countryOfResidence: 'Unknown',
            accountType: 'MYSELF',
            accountCategory: 'PRIMARY_ACCOUNT',
            verificationMethod: 'EMAIL',
          });
          await user.save();
        }
      }

      // Generate JWT token
      /* Uncomment if you need to use the token
      const token = jwt.sign(
        { userId: user._id, email: user.email },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '1h' }
      );
      */

      // Redirect to frontend with success
      res.redirect(`/socials?success=true&provider=linkedin`);
    } catch (err) {
      logger.error('LinkedIn authentication failed:', err);
      res.status(500).json({ error: 'LinkedIn authentication failed' });
    }
  }

  // Get current user info
  static async getCurrentUser(req: Request, res: Response) {
    try {
      // Extract token from cookies or Authorization header
      const token = req.cookies.accessToken || req.header('Authorization')?.replace('Bearer ', '');

      if (!token) {
        return res.status(401).json({ success: false, message: 'No token provided' });
      }

      // Verify the token
      const decoded = (jwt as any).verify(token, process.env.JWT_SECRET || 'your-secret-key') as { userId: string, email: string };

      // Find the user
      const user = await User.findById(decoded.userId);

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Return user data
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
          profileImage: user.profileImage
        }
      });
    } catch (err) {
      console.error('Token verification error:', err);
      res.status(401).json({ success: false, message: 'Invalid token' });
    }
  }
}
