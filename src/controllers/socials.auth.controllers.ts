import { Request, Response } from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/User';
import { logger } from '../utils/logger';

class AuthSocialController {
  async googleAuth(req: Request, res: Response) {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    try {
      const { data } = await axios.post('https://oauth2.googleapis.com/token', {
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        code,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      });

      const { access_token } = data;

      // Fetch user profile using the access token
      const { data: profile } = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      let user = await User.findOne({ googleId: profile.id });

      if (!user) {
    
        user = await User.findOne({ email: profile.email });

        if (user) {
          user.googleId = profile.id;
          user.signupType = 'google';
          await user.save();
        } else {
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
      const token = this.generateToken(user);

      //Send the response
      res.json({ token, user });
    } catch (err) {
      logger.error('Google authentication failed:', err);
      res.status(500).json({ error: 'Google authentication failed' });
    }
  }

  //Facebook OAuth2
  async facebookAuth(req: Request, res: Response) {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    try {
      //Exchange the authorization code for an access token
      const { data } = await axios.get('https://graph.facebook.com/v12.0/oauth/access_token', {
        params: {
          client_id: process.env.FACEBOOK_APP_ID,
          client_secret: process.env.FACEBOOK_APP_SECRET,
          redirect_uri: process.env.FACEBOOK_REDIRECT_URI,
          code,
        },
      });

      const { access_token } = data;

      const { data: profile } = await axios.get('https://graph.facebook.com/v12.0/me', {
        params: {
          fields: 'id,name,email',
          access_token,
        },
      });

      let user = await User.findOne({ facebookId: profile.id });

      if (!user) {
        user = await User.findOne({ email: profile.email });

        if (user) {
          user.facebookId = profile.id;
          user.signupType = 'facebook';
          await user.save();
        } else {
          
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
      const token = this.generateToken(user);

      // Send the response
      res.json({ token, user });
    } catch (err) {
      logger.error('Facebook authentication failed:', err);
      res.status(500).json({ error: 'Facebook authentication failed' });
    }
  }

  // Generate JWT token
  private generateToken(user: IUser): string {
    return jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: '1h' }
    );
  }
}

export default new AuthSocialController();