#!/usr/bin/env node

/**
 * ProfileVerification Initialization Script
 *
 * This script automatically initializes ProfileVerification records for all existing
 * user profiles in the MongoDB database that don't already have verification records.
 *
 * Usage:
 *   npm run script:init-verification           # Run the initialization
 *   npm run script:init-verification --dry-run # Preview without making changes
 *
 * Features:
 * - Connects to MongoDB using existing configuration
 * - Processes all profiles without verification records
 * - Uses existing VerificationService.initializeVerification() method
 * - Provides detailed logging and progress tracking
 * - Handles errors gracefully and continues processing
 * - Supports dry-run mode for safe preview
 * - Generates comprehensive summary report
 */

import mongoose from 'mongoose';
import { config } from '../src/config/config';
import { VerificationService } from '../src/services/verification.service';
import { ProfileModel } from '../src/models/profile.model';
import { ProfileVerification } from '../src/models/profile-verification.model';
// Import User model to register it with Mongoose (needed for populate)
import { User } from '../src/models/User';

interface ProcessingStats {
  totalProfiles: number;
  alreadyHaveVerification: number;
  successfullyInitialized: number;
  failed: number;
  skippedNoUser: number;
  processed: number;
}

interface ProfileData {
  profileId: string;
  userId: string;
  username: string;
  email: string;
  phoneNumber?: string;
  formattedPhoneNumber?: string;
  countryOfResidence?: string;
}

class VerificationInitializer {
  private stats: ProcessingStats = {
    totalProfiles: 0,
    alreadyHaveVerification: 0,
    successfullyInitialized: 0,
    failed: 0,
    skippedNoUser: 0,
    processed: 0
  };

  private isDryRun: boolean = false;
  private failedProfiles: Array<{ profileId: string; error: string }> = [];

  constructor(isDryRun: boolean = false) {
    this.isDryRun = isDryRun;
  }

  /**
   * Connect to MongoDB using existing configuration
   */
  private async connectToDatabase(): Promise<void> {
    try {
      console.log('🔌 Connecting to MongoDB...');
      await mongoose.connect(config.MONGODB_URI);

      // Ensure User model is registered (needed for populate to work)
      if (User) {
        console.log('📝 User model registered successfully');
      }

      console.log('✅ Connected to MongoDB successfully');
    } catch (error) {
      console.error('❌ Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  /**
   * Disconnect from MongoDB
   */
  private async disconnectFromDatabase(): Promise<void> {
    try {
      await mongoose.disconnect();
      console.log('🔌 Disconnected from MongoDB');
    } catch (error) {
      console.error('❌ Error disconnecting from MongoDB:', error);
    }
  }

  /**
   * Get all profiles that don't have verification records
   */
  private async getProfilesWithoutVerification(): Promise<ProfileData[]> {
    console.log('🔍 Finding profiles without verification records...');

    try {
      // Get all profile IDs that already have verification records
      const existingVerifications = await ProfileVerification.find({}, { profileId: 1 }).lean();
      const existingProfileIds = existingVerifications.map((v: any) => v.profileId.toString());

      console.log(`📊 Found ${existingVerifications.length} existing verification records`);

      // Get all profiles that don't have verification records
      const profilesWithoutVerification = await ProfileModel.find({
        _id: { $nin: existingProfileIds }
      }).populate('profileInformation.creator').lean();

      console.log(`📊 Found ${profilesWithoutVerification.length} profiles without verification records`);

      // Transform to ProfileData format
      const profileData: ProfileData[] = [];

      for (const profile of profilesWithoutVerification) {
        const user = profile.profileInformation.creator as any;

        if (!user) {
          console.warn(`⚠️  Profile ${profile._id} has no associated user, skipping`);
          this.stats.skippedNoUser++;
          continue;
        }

        profileData.push({
          profileId: profile._id.toString(),
          userId: user._id.toString(),
          username: profile.profileInformation.username,
          email: user.email,
          phoneNumber: user.phoneNumber,
          formattedPhoneNumber: user.formattedPhoneNumber,
          countryOfResidence: user.countryOfResidence
        });
      }

      this.stats.totalProfiles = profilesWithoutVerification.length;
      this.stats.alreadyHaveVerification = existingVerifications.length;

      return profileData;
    } catch (error) {
      console.error('❌ Error finding profiles without verification:', error);
      throw error;
    }
  }

  /**
   * Initialize verification for a single profile
   */
  private async initializeProfileVerification(profileData: ProfileData): Promise<boolean> {
    try {
      if (this.isDryRun) {
        console.log(`🔍 [DRY RUN] Would initialize verification for profile ${profileData.profileId} (${profileData.username})`);
        return true;
      }

      const result = await VerificationService.initializeVerification(
        profileData.profileId,
        profileData.userId,
        profileData.email,
        profileData.phoneNumber || '',
        profileData.formattedPhoneNumber || profileData.phoneNumber || '',
        profileData.countryOfResidence || 'US'
      );

      if (result.success) {
        console.log(`✅ Successfully initialized verification for profile ${profileData.profileId} (${profileData.username})`);
        return true;
      } else {
        console.error(`❌ Failed to initialize verification for profile ${profileData.profileId}: ${result.message}`);
        this.failedProfiles.push({
          profileId: profileData.profileId,
          error: result.message || 'Unknown error'
        });
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Error initializing verification for profile ${profileData.profileId}:`, errorMessage);
      this.failedProfiles.push({
        profileId: profileData.profileId,
        error: errorMessage
      });
      return false;
    }
  }

  /**
   * Process all profiles without verification records
   */
  private async processProfiles(profiles: ProfileData[]): Promise<void> {
    console.log(`\n🚀 ${this.isDryRun ? '[DRY RUN] ' : ''}Starting to process ${profiles.length} profiles...\n`);

    for (let i = 0; i < profiles.length; i++) {
      const profile = profiles[i];
      this.stats.processed++;

      // Show progress
      const progress = Math.round((this.stats.processed / profiles.length) * 100);
      console.log(`\n📊 Progress: ${this.stats.processed}/${profiles.length} (${progress}%)`);
      console.log(`🔄 Processing profile ${profile.profileId} (${profile.username})...`);

      const success = await this.initializeProfileVerification(profile);

      if (success) {
        this.stats.successfullyInitialized++;
      } else {
        this.stats.failed++;
      }

      // Add a small delay to avoid overwhelming the database
      if (!this.isDryRun && i < profiles.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }

  /**
   * Generate and display summary report
   */
  private displaySummaryReport(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 VERIFICATION INITIALIZATION SUMMARY REPORT');
    console.log('='.repeat(60));
    console.log(`🔍 Mode: ${this.isDryRun ? 'DRY RUN (no changes made)' : 'LIVE RUN'}`);
    console.log(`📈 Total profiles found: ${this.stats.totalProfiles}`);
    console.log(`✅ Already had verification: ${this.stats.alreadyHaveVerification}`);
    console.log(`🚀 Processed: ${this.stats.processed}`);
    console.log(`✅ Successfully initialized: ${this.stats.successfullyInitialized}`);
    console.log(`❌ Failed: ${this.stats.failed}`);
    console.log(`⚠️  Skipped (no user): ${this.stats.skippedNoUser}`);

    if (this.failedProfiles.length > 0) {
      console.log('\n❌ FAILED PROFILES:');
      this.failedProfiles.forEach(({ profileId, error }) => {
        console.log(`   - ${profileId}: ${error}`);
      });
    }

    console.log('\n' + '='.repeat(60));

    if (!this.isDryRun && this.stats.successfullyInitialized > 0) {
      console.log('🎉 Verification initialization completed successfully!');
      console.log('💡 Users can now access the verification page without initialization errors.');
    } else if (this.isDryRun) {
      console.log('💡 Run without --dry-run flag to actually initialize verification records.');
    }
  }

  /**
   * Main execution method
   */
  public async run(): Promise<void> {
    const startTime = Date.now();

    try {
      console.log('🚀 ProfileVerification Initialization Script');
      console.log(`🔍 Mode: ${this.isDryRun ? 'DRY RUN' : 'LIVE RUN'}`);
      console.log('='.repeat(50));

      // Connect to database
      await this.connectToDatabase();

      // Get profiles without verification
      const profiles = await this.getProfilesWithoutVerification();

      if (profiles.length === 0) {
        console.log('🎉 All profiles already have verification records! Nothing to do.');
        return;
      }

      // Process profiles
      await this.processProfiles(profiles);

      // Display summary
      this.displaySummaryReport();

    } catch (error) {
      console.error('💥 Script execution failed:', error);
      process.exit(1);
    } finally {
      // Disconnect from database
      await this.disconnectFromDatabase();

      const duration = Math.round((Date.now() - startTime) / 1000);
      console.log(`⏱️  Total execution time: ${duration} seconds`);
    }
  }
}

// Script execution
async function main() {
  // Check for dry-run flag
  const isDryRun = process.argv.includes('--dry-run');

  const initializer = new VerificationInitializer(isDryRun);
  await initializer.run();
}

// Run the script if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
  });
}

export { VerificationInitializer };
