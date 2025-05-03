import mongoose from 'mongoose';
import { config } from '../config/config';
import { ProfileModel } from '../models/profile.model';
import { ProfileReferralService } from '../services/profile-referral.service';
import { logger } from '../utils/logger';

/**
 * Script to initialize referral codes for all existing profiles
 */
async function initializeReferralCodes() {
  try {
    // Connect to MongoDB
    await mongoose.connect(config.MONGODB_URI);
    logger.info('Connected to MongoDB');

    // Get all profiles
    const profiles = await ProfileModel.find({});
    logger.info(`Found ${profiles.length} profiles`);

    // Initialize referral codes for all profiles
    let successCount = 0;
    let errorCount = 0;

    for (const profile of profiles) {
      try {
        const referral = await ProfileReferralService.initializeReferralCode(profile._id);
        logger.info(`Initialized referral code for profile ${profile._id}: ${referral.referralCode}`);
        successCount++;
      } catch (error) {
        logger.error(`Error initializing referral code for profile ${profile._id}:`, error);
        errorCount++;
      }
    }

    logger.info(`Initialization complete. Success: ${successCount}, Errors: ${errorCount}`);
  } catch (error) {
    logger.error('Error initializing referral codes:', error);
  } finally {
    // Disconnect from MongoDB
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
  }
}

// Run the script
initializeReferralCodes()
  .then(() => {
    logger.info('Script completed');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Script failed:', error);
    process.exit(1);
  });
