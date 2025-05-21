/**
 * Script to update all existing profiles with gradient backgrounds
 *
 * This script:
 * 1. Connects to the MongoDB database
 * 2. Finds all profiles that don't have a ProfileFormat.profileImage field or have an empty one
 * 3. Generates a unique gradient background for each profile based on the username
 * 4. Updates the profile with the new ProfileFormat object
 *
 * Run with: npm run update-gradients
 * or: npx ts-node src/scripts/update-profiles-with-gradients.ts
 */

import mongoose from 'mongoose';
import { config } from '../config/config';
import { ProfileModel } from '../models/profile.model';
import { generateProfileGradient } from '../utils/gradient-generator';
import { logger } from '../utils/logger';

/**
 * Updates all profiles with gradient backgrounds
 * @returns Object containing counts of updated profiles and errors
 */
export async function updateProfilesWithGradients() {
  try {
    // Connect to MongoDB
    logger.info('Connecting to MongoDB...');
    await mongoose.connect(config.MONGODB_URI);
    logger.info('Connected to MongoDB');

    // Find all profiles without a ProfileFormat.profileImage field or with an empty one
    const profiles = await ProfileModel.find({
      $or: [
        { 'ProfileFormat.profileImage': { $exists: false } },
        { 'ProfileFormat.profileImage': '' },
        { 'ProfileFormat.profileImage': null }
      ]
    });
    logger.info(`Found ${profiles.length} profiles without a profile image`);

    let updatedCount = 0;
    let errorCount = 0;

    // Process profiles in batches to avoid memory issues
    const batchSize = 50;
    const batches = Math.ceil(profiles.length / batchSize);

    for (let i = 0; i < batches; i++) {
      const start = i * batchSize;
      const end = Math.min(start + batchSize, profiles.length);
      const batch = profiles.slice(start, end);

      logger.info(`Processing batch ${i + 1}/${batches} (${batch.length} profiles)...`);

      // Process each profile in the batch
      for (const profile of batch) {
        try {
          // Get the username
          const username = profile.profileInformation?.username || 'Unknown User';

          // Generate a unique gradient background based on the username
          const { gradient, primaryColor, secondaryColor } = generateProfileGradient(username);

          // Initialize or update the ProfileFormat object
          if (!profile.ProfileFormat) {
            profile.ProfileFormat = {
              profileImage: '',
              customization: {
                theme: {
                  primaryColor: primaryColor,
                  secondaryColor: secondaryColor,
                  background: gradient,
                }
              },
              updatedAt: new Date()
            };
          } else {
            // Update existing ProfileFormat
            profile.ProfileFormat.profileImage = profile.ProfileFormat.profileImage || '';

            // Initialize customization if it doesn't exist
            if (!profile.ProfileFormat.customization) {
              profile.ProfileFormat.customization = {
                theme: {
                  primaryColor: primaryColor,
                  secondaryColor: secondaryColor,
                  background: gradient,
                }
              };
            } else if (!profile.ProfileFormat.customization.theme) {
              // Initialize theme if it doesn't exist
              profile.ProfileFormat.customization.theme = {
                primaryColor: primaryColor,
                secondaryColor: secondaryColor,
                background: gradient,
              };
            } else {
              // Update existing theme
              profile.ProfileFormat.customization.theme.primaryColor = primaryColor;
              profile.ProfileFormat.customization.theme.secondaryColor = secondaryColor;
              profile.ProfileFormat.customization.theme.background = gradient;
            }

            profile.ProfileFormat.updatedAt = new Date();
          }

          // Save the updated profile
          await profile.save();

          logger.info(`Updated profile ${profile._id} with gradient background for user "${username}"`);
          updatedCount++;
        } catch (error) {
          logger.error(`Error updating profile ${profile._id}:`, error);
          errorCount++;
        }
      }
    }

    logger.info(`Profile gradient update process completed.`);
    logger.info(`Updated ${updatedCount} profiles.`);
    logger.info(`Encountered errors with ${errorCount} profiles.`);

    return { updatedCount, errorCount };
  } catch (error) {
    logger.error('Error in updateProfilesWithGradients:', error);
    throw error;
  } finally {
    // Close the MongoDB connection
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
  }
}

// Main function
async function main() {
  try {
    const result = await updateProfilesWithGradients();
    console.log('Script completed successfully:', result);
    process.exit(0);
  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  }
}

// Run the script only if this file is executed directly
if (require.main === module) {
  main();
}
