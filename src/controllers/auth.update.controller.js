const { User } = require('../models/User');
const { logger } = require('../utils/logger');

/**
 * Controller for handling user profile updates
 */
class AuthUpdateController {
  /**
   * Update user profile information
   * @route POST /auth/update-profile
   */
  static async updateProfile(req, res) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const { dateOfBirth, countryOfResidence, phoneNumber, referralCode, wasReferred } = req.body;

      console.log('Update profile request body:', { dateOfBirth, countryOfResidence, phoneNumber, referralCode, wasReferred });

      // Validate that at least one field is provided
      if (!dateOfBirth && !countryOfResidence && !phoneNumber && !referralCode) {
        return res.status(400).json({
          success: false,
          message: 'No fields to update'
        });
      }

      // Log the referral code if provided
      if (referralCode) {
        logger.info(`Processing referral code for user ${user._id}: ${referralCode}`);
      }

      // Find the user by ID
      const userToUpdate = await User.findById(user._id);

      if (!userToUpdate) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Update fields if provided
      if (dateOfBirth) {
        userToUpdate.dateOfBirth = new Date(dateOfBirth);
      }

      if (countryOfResidence) {
        userToUpdate.countryOfResidence = countryOfResidence;
      }

      // Handle phone number update
      if (phoneNumber) {
        // Validate phone number (minimum 8 characters)
        if (phoneNumber.length < 8) {
          return res.status(400).json({
            success: false,
            message: 'Phone number must be at least 8 characters long'
          });
        }

        // Normalize phone number (remove all non-numeric characters except +)
        const normalizedPhoneNumber = phoneNumber.replace(/[^\d+]/g, '');

        console.log('Setting phone number:', { original: phoneNumber, normalized: normalizedPhoneNumber });

        userToUpdate.phoneNumber = normalizedPhoneNumber;
        userToUpdate.formattedPhoneNumber = phoneNumber; // Keep original formatting
      }

      // Store the referral code in the tempReferralCode field
      if (referralCode) {
        userToUpdate.tempReferralCode = referralCode;
        logger.info(`Stored referral code in tempReferralCode field: ${referralCode}`);
      }

      // Save the updated user
      await userToUpdate.save();

      // Process referral code if provided
      if (referralCode) {
        try {
          // Get the user's profile
          const { ProfileService } = require('../services/profile.service');
          const profileService = new ProfileService();

          logger.info(`Attempting to find profile for user ${user._id} to process referral code ${referralCode}`);

          // Get the profile for this user
          const profile = await profileService.getProfileByUserId(user._id);

          if (profile) {
            logger.info(`Found profile ${profile._id} for user ${user._id}, proceeding with referral processing`);

            // Process the referral code
            const { ProfileReferralService } = require('../services/profile-referral.service');

            // Validate the referral code
            logger.info(`Validating referral code: ${referralCode}`);
            const referringProfileId = await ProfileReferralService.validateReferralCode(referralCode);

            if (referringProfileId) {
              logger.info(`Referral code ${referralCode} is valid, referring profile ID: ${referringProfileId}`);

              // Check if this profile has already been referred
              const referringProfile = await ProfileReferralService.getProfileReferral(referringProfileId);
              if (referringProfile) {
                const alreadyReferred = referringProfile.referredProfiles.some(
                  ref => ref.profileId.toString() === String(profile._id)
                );

                if (alreadyReferred) {
                  logger.info(`Profile ${profile._id} has already been referred by ${referringProfileId}, skipping`);
                } else {
                  // Process the referral
                  logger.info(`Processing referral: ${profile._id} referred by ${referringProfileId}`);
                  const referralProcessed = await ProfileReferralService.processReferral(String(profile._id), referringProfileId);

                  if (referralProcessed) {
                    logger.info(`Successfully processed referral for profile ${profile._id} with referral code ${referralCode}`);
                  } else {
                    logger.error(`Failed to process referral for profile ${profile._id} with referral code ${referralCode}`);
                  }
                }
              } else {
                logger.error(`Could not find referring profile with ID ${referringProfileId}`);
              }
            } else {
              logger.warn(`Invalid referral code provided: ${referralCode}`);
            }
          } else {
            logger.error(`No profile found for user ${user._id}`);
          }
        } catch (referralError) {
          logger.error(`Error processing referral for user ${user._id}:`, referralError);
          // Continue even if referral processing fails
        }
      }

      logger.info(`User ${user._id} updated profile information`);

      // Return success response
      return res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        user: {
          id: userToUpdate._id,
          email: userToUpdate.email,
          fullName: userToUpdate.fullName,
          username: userToUpdate.username,
          dateOfBirth: userToUpdate.dateOfBirth,
          countryOfResidence: userToUpdate.countryOfResidence,
          phoneNumber: userToUpdate.phoneNumber,
          formattedPhoneNumber: userToUpdate.formattedPhoneNumber,
          profileImage: userToUpdate.profileImage,
          referralCode: userToUpdate.referralCode
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

module.exports = { AuthUpdateController };
