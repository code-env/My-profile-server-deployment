import mongoose from 'mongoose';
import { config } from '../config/config';
import { logger } from '../utils/logger';

// Import models
const ProfileModel = require('../models/profile.model');
const MyPtsModel = require('../models/my-pts.model');
const ActivityTrackingService = require('../services/activity-tracking.service');

// Database connection function
async function connectToDatabase(): Promise<void> {
  try {
    const mongoUri = process.env.MONGODB_URI || config.MONGODB_URI;
    await mongoose.connect(mongoUri, {
      authSource: "admin",
      maxPoolSize: 10,
      minPoolSize: 2,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      serverSelectionTimeoutMS: 10000,
    });
    console.log('✅ Database connected successfully');
    console.log(`📊 Connected to database: ${mongoose.connection.db?.databaseName || 'unknown'}`);
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}

// Main function to award retroactive platform join rewards
async function awardRetroactivePlatformJoinRewards(): Promise<void> {
  try {
    await connectToDatabase();

    console.log('\n🎯 Starting Retroactive Platform Join Rewards...');
    console.log('=====================================================');

    // Find all profiles and users to validate relationships
    console.log('\n🔍 Finding eligible profiles...');

    // Get all users to validate profile-user relationships
    const { default: UserModel } = require('../models/User');
    const allUsers = await UserModel.find({}).select('_id email');
    const validUserIds = new Set(allUsers.map((user: any) => user._id.toString()));

    console.log(`📊 Total users in database: ${allUsers.length}`);

    // Find profiles that haven't received any MyPts rewards
    const profilesWithoutRewards = await ProfileModel.find({
      $and: [
        { 'ProfileMypts.lifetimeMypts': { $in: [0, null, undefined] } },
        { 'ProfileMypts.currentBalance': { $in: [0, null, undefined] } }
      ]
    }).select('_id profileInformation.username profileInformation.creator ProfileMypts createdAt');

    console.log(`📊 Profiles without MyPts rewards: ${profilesWithoutRewards.length}`);

    // Filter profiles to only include those with valid user accounts
    const eligibleProfiles = profilesWithoutRewards.filter((profile: any) => {
      const creatorId = profile.profileInformation?.creator?.toString();
      return creatorId && validUserIds.has(creatorId);
    });

    const orphanedProfiles = profilesWithoutRewards.filter((profile: any) => {
      const creatorId = profile.profileInformation?.creator?.toString();
      return !creatorId || !validUserIds.has(creatorId);
    });

    console.log(`✅ Eligible profiles (with valid user accounts): ${eligibleProfiles.length}`);
    console.log(`❌ Orphaned profiles (no user account): ${orphanedProfiles.length}`);

    if (orphanedProfiles.length > 0) {
      console.log('\n🚨 Orphaned profiles found (will be skipped):');
      orphanedProfiles.slice(0, 5).forEach((profile: any, index: number) => {
        console.log(`  ${index + 1}. ${profile.profileInformation?.username || 'Unknown'} (${profile._id})`);
        console.log(`     Creator ID: ${profile.profileInformation?.creator || 'Missing'}`);
      });
      if (orphanedProfiles.length > 5) {
        console.log(`     ... and ${orphanedProfiles.length - 5} more orphaned profiles`);
      }
    }

    if (eligibleProfiles.length === 0) {
      console.log('✅ No eligible profiles found. All profiles have already received rewards.');
      return;
    }

    // Show sample of eligible profiles
    console.log('\n📋 Sample of eligible profiles:');
    eligibleProfiles.slice(0, 5).forEach((profile: any, index: number) => {
      console.log(`  ${index + 1}. ${profile.profileInformation?.username || 'Unknown'} (${profile._id})`);
      console.log(`     Created: ${profile.createdAt}`);
      console.log(`     Current Balance: ${profile.ProfileMypts?.currentBalance || 0}`);
      console.log(`     Lifetime MyPts: ${profile.ProfileMypts?.lifetimeMypts || 0}`);
    });

    if (eligibleProfiles.length > 5) {
      console.log(`     ... and ${eligibleProfiles.length - 5} more profiles`);
    }

    // Confirm before proceeding
    console.log(`\n⚠️  About to award 100 MyPts to ${eligibleProfiles.length} profiles`);
    console.log('   This will:');
    console.log('   - Award 100 MyPts platform join bonus to each profile');
    console.log('   - Create transaction records for each award');
    console.log('   - Move tokens from MyPts Hub reserves to circulation');
    console.log('   - Update profile balances and lifetime earnings');

    // In a real environment, you might want to add a confirmation prompt
    // For now, we'll proceed automatically
    console.log('\n🚀 Proceeding with retroactive rewards...');

    let successCount = 0;
    let errorCount = 0;
    const errors: Array<{ profileId: string; error: string }> = [];

    // Process profiles in batches to avoid overwhelming the system
    const batchSize = 10;
    const totalBatches = Math.ceil(eligibleProfiles.length / batchSize);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIndex = batchIndex * batchSize;
      const endIndex = Math.min(startIndex + batchSize, eligibleProfiles.length);
      const batch = eligibleProfiles.slice(startIndex, endIndex);

      console.log(`\n📦 Processing batch ${batchIndex + 1}/${totalBatches} (${batch.length} profiles)...`);

      // Process each profile in the batch
      for (const profile of batch) {
        try {
          console.log(`  🎯 Processing profile: ${profile.profileInformation?.username || 'Unknown'} (${profile._id})`);

          // Use ActivityTrackingService to award the platform join bonus
          const activityTrackingService = new ActivityTrackingService();
          const result = await activityTrackingService.trackActivity(
            profile._id,
            'platform_join',
            {
              userId: profile.profileInformation?.creator?.toString() || 'unknown',
              profileId: profile._id.toString(),
              timestamp: new Date(),
              description: 'Retroactive platform join bonus',
              isRetroactive: true
            }
          );

          if (result.success && result.pointsEarned > 0) {
            console.log(`    ✅ Awarded ${result.pointsEarned} MyPts to ${profile.profileInformation?.username || 'Unknown'}`);
            successCount++;
          } else {
            console.log(`    ❌ Failed to award MyPts to ${profile.profileInformation?.username || 'Unknown'}: ${JSON.stringify(result)}`);
            errorCount++;
            errors.push({
              profileId: profile._id.toString(),
              error: `Award failed: ${JSON.stringify(result)}`
            });
          }

          // Small delay to avoid overwhelming the database
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
          console.error(`    ❌ Error processing profile ${profile._id}:`, error);
          errorCount++;
          errors.push({
            profileId: profile._id.toString(),
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Delay between batches
      if (batchIndex < totalBatches - 1) {
        console.log('    ⏳ Waiting before next batch...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Summary
    console.log('\n📊 Retroactive Rewards Summary:');
    console.log('================================');
    console.log(`✅ Successfully awarded: ${successCount} profiles`);
    console.log(`❌ Failed awards: ${errorCount} profiles`);
    console.log(`💰 Total MyPts awarded: ${successCount * 100} MyPts`);
    console.log(`📈 Profiles processed: ${successCount + errorCount}/${eligibleProfiles.length}`);

    if (errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      errors.forEach((error, index) => {
        console.log(`  ${index + 1}. Profile ${error.profileId}: ${error.error}`);
      });
    }

    if (successCount > 0) {
      console.log('\n🎉 Retroactive platform join rewards completed successfully!');
      console.log(`   ${successCount} profiles now have their 100 MyPts platform join bonus`);
    }

  } catch (error) {
    console.error('❌ Script execution failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Database disconnected');
    process.exit(0);
  }
}

// Execute the script
if (require.main === module) {
  awardRetroactivePlatformJoinRewards().catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}

export { awardRetroactivePlatformJoinRewards };
