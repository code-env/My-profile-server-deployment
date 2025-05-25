/**
 * Script to fix users with missing country information
 * This script identifies users without country information and updates their profiles
 * with a placeholder value to prevent them from being skipped in future updates
 *
 * Run with: npx ts-node src/scripts/fix-missing-country-users.ts
 */

import mongoose from 'mongoose';
import { config } from 'dotenv';
import { ProfileModel } from '../models/profile.model';
import { User } from '../models/User';
import { logger } from '../utils/logger';

// Load environment variables
config();

interface UserWithoutCountry {
  _id: string;
  email: string;
  fullName: string;
  signupType: string;
  countryOfResidence?: string;
  profileCount: number;
}

async function fixMissingCountryUsers() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable is not set');
    }

    await mongoose.connect(mongoUri);
    logger.info('Connected to MongoDB');

    // Find users missing any required fields or isProfileComplete field
    const usersToUpdate = await User.aggregate([
      {
        $match: {
          $or: [
            { countryOfResidence: { $exists: false } },
            { countryOfResidence: null },
            { countryOfResidence: '' },
            { countryOfResidence: 'Unknown' },
            { dateOfBirth: { $exists: false } },
            { dateOfBirth: null },
            { phoneNumber: { $exists: false } },
            { phoneNumber: null },
            { phoneNumber: '' },
            { isProfileComplete: { $exists: false } }
          ]
        }
      },
      {
        $lookup: {
          from: 'profiles',
          localField: '_id',
          foreignField: 'profileInformation.creator',
          as: 'profiles'
        }
      },
      {
        $project: {
          _id: 1,
          email: 1,
          fullName: 1,
          signupType: 1,
          countryOfResidence: 1,
          profileCount: { $size: '$profiles' }
        }
      }
    ]) as UserWithoutCountry[];

    logger.info(`Found ${usersToUpdate.length} users that need updates (missing country info or isProfileComplete field)`);

    if (usersToUpdate.length === 0) {
      logger.info('No users found that need updates');
      return;
    }

    // Log details about these users
    logger.info('Users that need updates:');
    usersToUpdate.forEach(user => {
      logger.info(`- ${user.email} (${user.signupType}, ${user.profileCount} profiles) - Country: ${user.countryOfResidence || 'undefined'}`);
    });

    let updatedUsers = 0;
    let updatedProfiles = 0;

    // Process each user
    for (const userData of usersToUpdate) {
      try {
        // Get the full user document to check all fields
        const user = await User.findById(userData._id);
        if (!user) {
          logger.warn(`User ${userData._id} not found, skipping`);
          continue;
        }

        let needsUpdate = false;
        const updateFields: any = {};

        // Check and fix missing country
        if (!user.countryOfResidence || user.countryOfResidence === 'Unknown') {
          updateFields.countryOfResidence = 'Not Specified';
          needsUpdate = true;
          logger.info(`User ${userData.email} missing country, setting placeholder`);
        }

        // Check if isProfileComplete field needs to be set
        if (user.isProfileComplete === undefined) {
          // Check if they have ALL required fields
          const hasAllRequiredFields = user.countryOfResidence &&
                                      user.countryOfResidence !== 'Unknown' &&
                                      user.countryOfResidence !== 'Not Specified' &&
                                      user.dateOfBirth &&
                                      user.phoneNumber;

          updateFields.isProfileComplete = hasAllRequiredFields;
          needsUpdate = true;

          const missingFields = [];
          if (!user.countryOfResidence || user.countryOfResidence === 'Unknown' || user.countryOfResidence === 'Not Specified') {
            missingFields.push('countryOfResidence');
          }
          if (!user.dateOfBirth) missingFields.push('dateOfBirth');
          if (!user.phoneNumber) missingFields.push('phoneNumber');

          logger.info(`User ${userData.email} isProfileComplete: ${hasAllRequiredFields}, missing fields: [${missingFields.join(', ')}]`);
        }

        // Apply updates if needed
        if (needsUpdate) {
          await User.updateOne(
            { _id: userData._id },
            { $set: updateFields }
          );
          updatedUsers++;
          logger.info(`Updated user ${userData.email} with fields: ${Object.keys(updateFields).join(', ')}`);
        }

        // Find and update all profiles for this user
        const profiles = await ProfileModel.find({
          'profileInformation.creator': userData._id
        });

        for (const profile of profiles) {
          // Check if profile already has country information
          const hasCountryInfo = profile.profileLocation?.country &&
                                profile.profileLocation.country !== '' &&
                                profile.profileLocation.country !== 'Unknown';

          if (!hasCountryInfo) {
            const result = await ProfileModel.updateOne(
              { _id: profile._id },
              {
                $set: {
                  'profileLocation.country': 'Not Specified',
                  'profileLocation.countryCode': '',
                  'profileLocation.coordinates.latitude': profile.profileLocation?.coordinates?.latitude || 0,
                  'profileLocation.coordinates.longitude': profile.profileLocation?.coordinates?.longitude || 0
                }
              }
            );

            if (result.modifiedCount > 0) {
              updatedProfiles++;
              logger.info(`Updated profile ${profile._id} for user ${userData.email} with placeholder country`);
            }
          }
        }

      } catch (error) {
        logger.error(`Error processing user ${userData.email}:`, error);
      }
    }

    logger.info(`Fix complete. Updated ${updatedUsers} users and ${updatedProfiles} profiles.`);

    // Generate a summary report
    const summary = {
      totalUsersFound: usersWithoutCountry.length,
      usersUpdated: updatedUsers,
      profilesUpdated: updatedProfiles,
      socialAuthUsers: usersWithoutCountry.filter(u => u.signupType !== 'email').length,
      emailUsers: usersWithoutCountry.filter(u => u.signupType === 'email').length
    };

    logger.info('Summary Report:', summary);

  } catch (error) {
    logger.error('Error in fix script:', error);
  } finally {
    // Close MongoDB connection
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
  }
}

// Run the fix function
fixMissingCountryUsers().catch(error => {
  logger.error('Unhandled error in script:', error);
  process.exit(1);
});
