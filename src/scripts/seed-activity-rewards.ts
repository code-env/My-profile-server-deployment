#!/usr/bin/env ts-node

import mongoose from 'mongoose';
import { ActivityRewardModel } from '../models/gamification/activity-reward.model';
import { BadgeCategory } from '../interfaces/gamification.interface';

// Database connection function - use the EXACT same connection as the server
async function connectToDatabase(): Promise<void> {
  try {
    // Use the exact same MongoDB URI as the server (which connects to 'test' database by default)
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/myprofile';
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

const defaultActivityRewards = [
  {
    activityType: 'profile_completion',
    pointsRewarded: 50,
    description: 'Complete your profile setup',
    category: BadgeCategory.PLATFORM_USAGE,
    isEnabled: false, // DISABLED for now - simplified reward system
    cooldownPeriod: 0, // One-time reward
    maxRewardsPerDay: 1
  },
  {
    activityType: 'platform_join',
    pointsRewarded: 100,
    description: 'Welcome bonus for joining the platform',
    category: BadgeCategory.PLATFORM_USAGE,
    isEnabled: true,
    cooldownPeriod: 0, // One-time reward
    maxRewardsPerDay: 1
  },
  {
    activityType: 'referral',
    pointsRewarded: 100,
    description: 'Refer a new user to the platform',
    category: BadgeCategory.NETWORKING,
    isEnabled: true,
    cooldownPeriod: 0,
    maxRewardsPerDay: 10
  },
  {
    activityType: 'daily_login',
    pointsRewarded: 10,
    description: 'Daily login bonus',
    category: BadgeCategory.PLATFORM_USAGE,
    isEnabled: true,
    cooldownPeriod: 24 * 60 * 60 * 1000, // 24 hours
    maxRewardsPerDay: 1
  },
  {
    activityType: 'profile_update',
    pointsRewarded: 5,
    description: 'Update your profile information',
    category: BadgeCategory.PLATFORM_USAGE,
    isEnabled: true,
    cooldownPeriod: 60 * 60 * 1000, // 1 hour
    maxRewardsPerDay: 3
  },
  {
    activityType: 'social_share',
    pointsRewarded: 15,
    description: 'Share content on social media',
    category: BadgeCategory.NETWORKING,
    isEnabled: true,
    cooldownPeriod: 30 * 60 * 1000, // 30 minutes
    maxRewardsPerDay: 5
  },
  {
    activityType: 'community_participation',
    pointsRewarded: 20,
    description: 'Participate in community activities',
    category: BadgeCategory.NETWORKING,
    isEnabled: true,
    cooldownPeriod: 15 * 60 * 1000, // 15 minutes
    maxRewardsPerDay: 10
  }
];

async function seedActivityRewards() {
  try {
    console.log('🌱 Starting ActivityReward seeding...');

    await connectToDatabase();
    console.log('✅ Database connected successfully');

    // Clear existing activity rewards
    const existingCount = await ActivityRewardModel.countDocuments();
    console.log(`📊 Found ${existingCount} existing activity rewards`);

    if (existingCount > 0) {
      console.log('🧹 Clearing existing activity rewards...');
      await ActivityRewardModel.deleteMany({});
      console.log('✅ Existing activity rewards cleared');
    }

    // Insert new activity rewards
    console.log('📝 Inserting default activity rewards...');
    const insertedRewards = await ActivityRewardModel.insertMany(defaultActivityRewards);

    console.log(`✅ Successfully seeded ${insertedRewards.length} activity rewards:`);
    insertedRewards.forEach(reward => {
      console.log(`  - ${reward.activityType}: ${reward.pointsRewarded} pts (${reward.description})`);
    });

    console.log('🎉 ActivityReward seeding completed successfully!');

  } catch (error) {
    console.error('❌ Error seeding activity rewards:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Database disconnected');
    process.exit(0);
  }
}

// Run the seeding script
if (require.main === module) {
  seedActivityRewards();
}

export { seedActivityRewards, defaultActivityRewards };
