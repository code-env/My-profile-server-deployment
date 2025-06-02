import { Request, Response } from 'express';
import { User } from '../models/User';
import { logger } from '../utils/logger';
import { AuthService } from '../services/auth.service';

/**
 * Controller for handling user profile updates
 */
export class AuthUpdateController {
  /**
   * Update user profile information
   * @route POST /auth/update-profile
   */
  static async updateProfile(req: Request, res: Response) {
    try {
      const user: any = req.user;
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const { dateOfBirth, countryOfResidence, phoneNumber, referralCode, wasReferred } = req.body;

      console.log('Update profile request body:', { dateOfBirth, countryOfResidence, phoneNumber, referralCode, wasReferred });

      // Validate that at least one field is provided (but allow empty strings to be processed)
      if (!dateOfBirth && !countryOfResidence && !phoneNumber && !referralCode) {
        return res.status(400).json({
          success: false,
          message: 'No fields to update'
        });
      }

      // Find the user by ID
      const userToUpdate = await User.findById(user._id);

      if (!userToUpdate) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Update fields if provided and valid
      if (dateOfBirth) {
        userToUpdate.dateOfBirth = new Date(dateOfBirth);
        console.log('Updated dateOfBirth:', userToUpdate.dateOfBirth);
      }

      if (countryOfResidence) {
        userToUpdate.countryOfResidence = countryOfResidence;
        console.log('Updated countryOfResidence:', userToUpdate.countryOfResidence);
      }

      // Handle phone number update - validate if provided
      if (phoneNumber) {
        // Basic phone number validation
        if (phoneNumber.length < 8) {
          return res.status(400).json({
            success: false,
            message: 'Phone number must be at least 8 characters long'
          });
        }

        // Normalize phone number (strip all non-numeric except +)
        const plainPhoneNumber = phoneNumber.replace(/[^+\d]/g, "");

        // Mark phone number as modified (to trigger pre-save hook handling)
        userToUpdate.markModified('phoneNumber');

        // Set the phone number values
        userToUpdate.phoneNumber = plainPhoneNumber;
        userToUpdate.formattedPhoneNumber = phoneNumber; // Optionally store formatted version

        console.log('Updated phoneNumber:', userToUpdate.phoneNumber);
      }

      // Add detailed logging to track the phone number
      console.log('**** CRITICAL DEBUG - Phone number tracking ****');
      console.log('1. Request body phoneNumber:', phoneNumber);
      console.log('2. Normalized phoneNumber:', userToUpdate.phoneNumber);
      console.log('3. User before save - isPhoneVerified:', userToUpdate.isPhoneVerified);
      console.log('4. User before save - signupType:', userToUpdate.signupType);
      console.log('5. User model schema phoneNumber required?:', User.schema.paths.phoneNumber.isRequired);

      // Handle referral if provided and user wasn't already referred
      if (wasReferred && referralCode && !userToUpdate.referredBy) {
        // NOTE: Referral processing is already handled during profile creation in ProfileService.createDefaultProfile
        // No need to process referrals again here to avoid duplicate rewards
        logger.info(`Referral code ${referralCode} provided for user ${userToUpdate._id} - will be processed during profile creation`);
      }

      // Mark profile as complete if ALL required fields are provided
      const hasAllRequiredFields = userToUpdate.dateOfBirth &&
                                   userToUpdate.countryOfResidence &&
                                   userToUpdate.phoneNumber;

      if (hasAllRequiredFields) {
        userToUpdate.isProfileComplete = true;
        logger.info(`Marked profile as complete for user ${user._id} - all required fields present`);
      } else {
        userToUpdate.isProfileComplete = false;
        logger.info(`Profile incomplete for user ${user._id} - missing fields: ${
          !userToUpdate.dateOfBirth ? 'dateOfBirth ' : ''
        }${!userToUpdate.countryOfResidence ? 'countryOfResidence ' : ''
        }${!userToUpdate.phoneNumber ? 'phoneNumber ' : ''}`);
      }

      // Log user state before save
      console.log('User state before save:', {
        phoneNumber: userToUpdate.phoneNumber,
        dateOfBirth: userToUpdate.dateOfBirth,
        countryOfResidence: userToUpdate.countryOfResidence,
        isProfileComplete: userToUpdate.isProfileComplete,
        signupType: userToUpdate.signupType
      });

      // Save the updated user
      const savedUser = await userToUpdate.save();

      // Force refresh from the database to ensure we have the latest data
      const refreshedUser = await User.findById(userToUpdate._id);

      // Add more logging after save
      console.log('**** CRITICAL DEBUG - After save ****');
      console.log('6. Saved user phoneNumber:', savedUser.phoneNumber);
      console.log('6b. Refreshed user phoneNumber:', refreshedUser?.phoneNumber);
      console.log('7. User object properties:', Object.keys(savedUser.toObject()));
      console.log('7b. Refreshed user properties:', refreshedUser ? Object.keys(refreshedUser.toObject()) : 'No refreshed user');
      console.log('8. User document complete?', savedUser.isProfileComplete);

      // Log user state after save
      console.log('User state after save:', {
        phoneNumber: savedUser.phoneNumber,
        dateOfBirth: savedUser.dateOfBirth,
        countryOfResidence: savedUser.countryOfResidence,
        isProfileComplete: savedUser.isProfileComplete,
        signupType: savedUser.signupType
      });

      logger.info(`User ${user._id} updated profile information`);

      // Generate fresh tokens
      const tokens = AuthService.generateTokens(userToUpdate._id.toString(), userToUpdate.email);

      // Set tokens in HTTP-only cookies
      // The cookie-config middleware will handle SameSite and Secure settings in production
      res.cookie("accesstoken", tokens.accessToken, {
        httpOnly: true,
        path: "/",
        maxAge: 1 * 60 * 60 * 1000, // 1 hour
      });

      res.cookie("refreshtoken", tokens.refreshToken, {
        httpOnly: true,
        path: "/",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      // Use the refreshed user data for the response
      const userForResponse = refreshedUser || savedUser;

      // Return success response with tokens
      return res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        user: {
          id: userForResponse._id,
          email: userForResponse.email,
          fullName: userForResponse.fullName,
          username: userForResponse.username,
          dateOfBirth: userForResponse.dateOfBirth,
          countryOfResidence: userForResponse.countryOfResidence,
          phoneNumber: userForResponse.phoneNumber, // Ensure phoneNumber is included
          formattedPhoneNumber: userForResponse.formattedPhoneNumber, // Include formatted version if present
          profileImage: userForResponse.profileImage,
          isProfileComplete: userForResponse.isProfileComplete,
          referralCode: userForResponse.referralCode
        },
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken
        },
        // Debug info - will only be shown in development environment
        __debug: process.env.NODE_ENV === 'production' ? undefined : {
          phoneNumberSaved: !!userForResponse.phoneNumber,
          phoneNumberValue: userForResponse.phoneNumber,
          allUserFields: Object.keys(userForResponse.toObject()),
          originalPhoneNumberValue: userToUpdate.phoneNumber,
          refreshedPhoneNumberValue: refreshedUser?.phoneNumber
        }
      });
    } catch (error) {
      logger.error('Error updating profile:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update profile'
      });
    }
  }
}
