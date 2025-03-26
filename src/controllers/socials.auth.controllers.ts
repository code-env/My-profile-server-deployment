import { Request, Response } from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/User';
import { logger } from '../utils/logger';
import { google } from 'googleapis';

const OAuth2 = google.auth.OAuth2;

const oauth2Client = new OAuth2(
"124684938199-e7ocs5m4npm1hm31i5e0j5sbqk9m62m9.apps.googleusercontent.com",
  "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",
  "https://friendly-memory-v5rv64x7jrj2jv7-5000.app.github.dev/api/sauth/google"
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


  static async googleConsent(req: Request, res: Response) {
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
      const { data } = await axios.post('https://oauth2.googleapis.com/authtoken', {
        client_id: "124684938199-e7ocs5m4npm1hm31i5e0j5sbqk9m62m9.apps.googleusercontent.com",
        client_secret:"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",
        code,
        redirect_uri: "https://friendly-memory-v5rv64x7jrj2jv7-5000.app.github.dev/api/sauth/google",
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
      const token = jwt.sign(
        { userId: user._id, email: user.email, role: user.role },
        process.env.JWT_SECRET!,
        { expiresIn: '1h' }
      );
  
      // Send the response
      res.status(200).json({message:"User created successfully" });      
    } catch (err) {
      // logger.error('Google authentication failed:', err);

      res.status(500).json({ error: 'Google authentication failed here', errors:err });
    }
  }

  // Redirect to Facebook's OAuth2 consent screen
  static async facebookConsent(req: Request, res: Response) {
    const url = `https://www.facebook.com/v12.0/dialog/oauth?client_id=${process.env.FACEBOOK_APP_ID}&redirect_uri=${process.env.FACEBOOK_REDIRECT_URI}&scope=email`;
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
          redirect_uri: process.env.FACEBOOK_REDIRECT_URI,
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
}