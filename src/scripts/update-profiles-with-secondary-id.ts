/**
 * Script to update all existing profiles with a secondary ID
 * 
 * This script:
 * 1. Connects to the MongoDB database
 * 2. Finds all profiles that don't have a secondary ID
 * 3. Generates a unique secondary ID for each profile
 * 4. Updates the profile with the new secondary ID
 * 
 * Run with: npm run update-secondary-ids
 * or: npx ts-node src/scripts/update-profiles-with-secondary-id.ts
 */

import mongoose from 'mongoose';
import { config } from '../config/config';
import { ProfileModel } from '../models/profile.model';
import { generateSecondaryId } from '../utils/crypto';
import { logger } from '../utils/logger';

/**
 * Updates all profiles with a secondary ID
 */
async function updateProfilesWithSecondaryId() {
  try {
    // Connect to MongoDB
    logger.info('Connecting to MongoDB...');
    await mongoose.connect(config.MONGODB_URI);
    logger.info('Connected to MongoDB');

    // Find all profiles without a secondary ID
    const profiles = await ProfileModel.find({ secondaryId: { $exists: false } });
    logger.info(`Found ${profiles.length} profiles without a secondary ID`);

    let updatedCount = 0;
    let errorCount = 0;

    // Process profiles in batches to avoid memory issues
    const batchSize = 100;
    for (let i = 0; i < profiles.length; i += batchSize) {
      const batch = profiles.slice(i, i + batchSize);
      logger.info(`Processing batch ${i / batchSize + 1} of ${Math.ceil(profiles.length / batchSize)}`);

      // Process each profile in the batch
      for (const profile of batch) {
        try {
          // Generate a unique secondary ID
          const secondaryId = await generateSecondaryId(async (id: string) => {
            // Check if the ID is unique
            const existingProfile = await ProfileModel.findOne({ secondaryId: id });
            return !existingProfile; // Return true if no profile with this ID exists
          });

          // Update the profile with the new secondary ID
          profile.secondaryId = secondaryId;
          await profile.save();

          logger.info(`Updated profile ${profile._id} with secondary ID ${secondaryId}`);
          updatedCount++;
        } catch (error) {
          logger.error(`Error updating profile ${profile._id}:`, error);
          errorCount++;
        }
      }

      // Log progress
      logger.info(`Processed ${Math.min(i + batchSize, profiles.length)} of ${profiles.length} profiles`);
    }

    logger.info(`Update completed: ${updatedCount} profiles updated, ${errorCount} errors`);
    process.exit(0);
  } catch (error) {
    logger.error('Error updating profiles with secondary ID:', error);
    process.exit(1);
  }
}

// Run the update function
updateProfilesWithSecondaryId();
