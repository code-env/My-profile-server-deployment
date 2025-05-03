import mongoose from 'mongoose';
import { config } from '../config/config';
import { ProfileReferralService } from '../services/profile-referral.service';
import { logger } from '../utils/logger';

/**
 * Script to initialize referral code for a specific profile
 */
async function initializeReferralCodeForProfile(profileId: string) {
  try {
    // Connect to MongoDB
    await mongoose.connect(config.MONGODB_URI);
    logger.info('Connected to MongoDB');

    // Initialize referral code for the profile
    try {
      const referral = await ProfileReferralService.initializeReferralCode(profileId);
      logger.info(`Initialized referral code for profile ${profileId}: ${referral.referralCode}`);
      return referral;
    } catch (error) {
      logger.error(`Error initializing referral code for profile ${profileId}:`, error);
      throw error;
    }
  } catch (error) {
    logger.error('Error initializing referral code:', error);
    throw error;
  } finally {
    // Disconnect from MongoDB
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
  }
}

// Profile ID from the command line argument
const profileId = process.argv[2];

if (!profileId) {
  console.error('Please provide a profile ID as a command line argument');
  process.exit(1);
}

// Run the script
initializeReferralCodeForProfile(profileId)
  .then((referral) => {
    logger.info('Script completed successfully');
    console.log('Referral code:', referral.referralCode);
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Script failed:', error);
    process.exit(1);
  });
