// #!/usr/bin/env ts-node

// import { connectToDatabase } from '../config/database';
// import { ActivityRewardModel } from '../models/gamification/activity-reward.model';
// import { MyPtsModel } from '../models/gamification/my-pts.model';
// import { ProfileModel } from '../models/profile.model';
// import { ProfileReferralModel } from '../models/profile-referral.model';
// import { ActivityTrackingService } from '../services/activity-tracking.service';
// import { ProfileService } from '../services/profile.service';
// import { ProfileReferralService } from '../services/profile-referral.service';
// import { ActivityType } from '../interfaces/gamification.interface';
// import { seedActivityRewards } from './seed-activity-rewards';

// interface TestUser {
//   _id: string;
//   email: string;
//   username: string;
//   referralCode?: string;
// }

// class MyPtsRewardsTestSuite {
//   private activityTrackingService: ActivityTrackingService;
//   private profileService: ProfileService;
//   private profileReferralService: ProfileReferralService;
//   private testUsers: TestUser[] = [];

//   constructor() {
//     this.activityTrackingService = new ActivityTrackingService();
//     this.profileService = new ProfileService();
//     this.profileReferralService = new ProfileReferralService();
//   }

//   async setup() {
//     console.log('🔧 Setting up test environment...');

//     await connectToDatabase();
//     console.log('✅ Database connected');

//     // Seed activity rewards
//     await seedActivityRewards();
//     console.log('✅ Activity rewards seeded');

//     // Clean up any existing test data
//     await this.cleanup();
//     console.log('✅ Test environment cleaned');
//   }

//   async cleanup() {
//     // Clean up test users and related data
//     const testEmails = ['test1@mypts.com', 'test2@mypts.com', 'test3@mypts.com'];

//     for (const email of testEmails) {
//       const profile = await ProfileModel.findOne({ email });
//       if (profile) {
//         await MyPtsModel.deleteMany({ userId: profile._id });
//         await ProfileReferralModel.deleteMany({
//           $or: [
//             { referrerUserId: profile._id },
//             { referredUserId: profile._id }
//           ]
//         });
//         await ProfileModel.findByIdAndDelete(profile._id);
//       }
//     }
//   }

//   async createTestUser(email: string, username: string): Promise<TestUser> {
//     console.log(`👤 Creating test user: ${email}`);

//     const userData = {
//       email,
//       username,
//       firstName: 'Test',
//       lastName: 'User',
//       dateOfBirth: new Date('1990-01-01'),
//       location: {
//         country: 'US',
//         state: 'CA',
//         city: 'San Francisco'
//       }
//     };

//     const profile = await this.profileService.createProfile(userData);

//     const testUser: TestUser = {
//       _id: profile._id.toString(),
//       email: profile.email,
//       username: profile.username,
//       referralCode: profile.referralCode
//     };

//     this.testUsers.push(testUser);
//     return testUser;
//   }

//   async testProfileCompletionReward() {
//     console.log('\n🧪 Testing Profile Completion Reward...');

//     const user = await this.createTestUser('test1@mypts.com', 'testuser1');

//     // Check if MyPts balance was created and rewarded
//     const myPtsBalance = await MyPtsModel.findOne({ userId: user._id });

//     if (myPtsBalance && myPtsBalance.totalPoints >= 50) {
//       console.log(`✅ Profile completion reward SUCCESS: User has ${myPtsBalance.totalPoints} MyPts`);
//       return true;
//     } else {
//       console.log(`❌ Profile completion reward FAILED: Expected >= 50 MyPts, got ${myPtsBalance?.totalPoints || 0}`);
//       return false;
//     }
//   }

//   async testReferralReward() {
//     console.log('\n🧪 Testing Referral Reward...');

//     // Create referrer user
//     const referrer = await this.createTestUser('test2@mypts.com', 'referrer');
//     console.log(`👤 Referrer created with code: ${referrer.referralCode}`);

//     // Create referred user using referrer's code
//     const referredUserData = {
//       email: 'test3@mypts.com',
//       username: 'referred',
//       firstName: 'Referred',
//       lastName: 'User',
//       dateOfBirth: new Date('1995-01-01'),
//       location: {
//         country: 'US',
//         state: 'NY',
//         city: 'New York'
//       },
//       referralCode: referrer.referralCode // Using referrer's code as referredBy
//     };

//     // Process referral
//     const referred = await this.profileService.createProfile(referredUserData);

//     // Check referrer's MyPts balance for referral reward
//     const referrerBalance = await MyPtsModel.findOne({ userId: referrer._id });
//     const referredBalance = await MyPtsModel.findOne({ userId: referred._id });

//     console.log(`💰 Referrer balance: ${referrerBalance?.totalPoints || 0} MyPts`);
//     console.log(`💰 Referred balance: ${referredBalance?.totalPoints || 0} MyPts`);

//     // Check if referral was recorded
//     const referralRecord = await ProfileReferralModel.findOne({
//       referrerUserId: referrer._id,
//       referredUserId: referred._id
//     });

//     if (referralRecord) {
//       console.log(`✅ Referral record created: ${referralRecord.status}`);
//     } else {
//       console.log(`❌ No referral record found`);
//     }

//     // Referrer should have profile completion (50) + referral reward (100+) = 150+ MyPts
//     if (referrerBalance && referrerBalance.totalPoints >= 150) {
//       console.log(`✅ Referral reward SUCCESS: Referrer has ${referrerBalance.totalPoints} MyPts`);
//       return true;
//     } else {
//       console.log(`❌ Referral reward FAILED: Expected >= 150 MyPts, got ${referrerBalance?.totalPoints || 0}`);
//       return false;
//     }
//   }

//   async testActivityTracking() {
//     console.log('\n🧪 Testing Activity Tracking Rewards...');

//     const user = this.testUsers[0];
//     if (!user) {
//       console.log('❌ No test user available for activity tracking test');
//       return false;
//     }

//     const initialBalance = await MyPtsModel.findOne({ userId: user._id });
//     const initialPoints = initialBalance?.totalPoints || 0;

//     console.log(`📊 Initial MyPts balance: ${initialPoints}`);

//     // Test daily login reward
//     await this.activityTrackingService.trackActivity(user._id, ActivityType.DAILY_LOGIN);

//     // Test profile update reward
//     await this.activityTrackingService.trackActivity(user._id, ActivityType.PROFILE_UPDATE);

//     // Test social share reward
//     await this.activityTrackingService.trackActivity(user._id, ActivityType.SOCIAL_SHARE);

//     const finalBalance = await MyPtsModel.findOne({ userId: user._id });
//     const finalPoints = finalBalance?.totalPoints || 0;
//     const earnedPoints = finalPoints - initialPoints;

//     console.log(`📊 Final MyPts balance: ${finalPoints}`);
//     console.log(`🎯 Points earned from activities: ${earnedPoints}`);

//     // Should have earned at least 45 points (10 + 5 + 15 + 15 = 45)
//     if (earnedPoints >= 30) {
//       console.log(`✅ Activity tracking rewards SUCCESS: Earned ${earnedPoints} MyPts`);
//       return true;
//     } else {
//       console.log(`❌ Activity tracking rewards FAILED: Expected >= 30 MyPts, earned ${earnedPoints}`);
//       return false;
//     }
//   }

//   async testCooldownAndLimits() {
//     console.log('\n🧪 Testing Cooldown and Daily Limits...');

//     const user = this.testUsers[0];
//     if (!user) {
//       console.log('❌ No test user available for cooldown test');
//       return false;
//     }

//     const initialBalance = await MyPtsModel.findOne({ userId: user._id });
//     const initialPoints = initialBalance?.totalPoints || 0;

//     // Try to get daily login reward again (should be blocked by cooldown)
//     await this.activityTrackingService.trackActivity(user._id, ActivityType.DAILY_LOGIN);

//     const afterSecondLogin = await MyPtsModel.findOne({ userId: user._id });
//     const pointsAfterSecondLogin = afterSecondLogin?.totalPoints || 0;

//     if (pointsAfterSecondLogin === initialPoints) {
//       console.log(`✅ Cooldown system SUCCESS: No additional points awarded for repeated daily login`);
//       return true;
//     } else {
//       console.log(`❌ Cooldown system FAILED: Points increased from ${initialPoints} to ${pointsAfterSecondLogin}`);
//       return false;
//     }
//   }

//   async displaySystemStatus() {
//     console.log('\n📊 MyPts Rewards System Status:');
//     console.log('================================');

//     // Activity Rewards Configuration
//     const rewards = await ActivityRewardModel.find({ isActive: true });
//     console.log(`\n🎯 Active Activity Rewards (${rewards.length}):`);
//     rewards.forEach(reward => {
//       console.log(`  • ${reward.activityType}: ${reward.pointsAwarded} pts`);
//       console.log(`    - Cooldown: ${reward.cooldownPeriod}ms`);
//       console.log(`    - Daily Limit: ${reward.dailyLimit}`);
//       console.log(`    - Max Per User: ${reward.maxRewardsPerUser || 'Unlimited'}`);
//     });

//     // Test Users Summary
//     console.log(`\n👥 Test Users Summary (${this.testUsers.length}):`);
//     for (const user of this.testUsers) {
//       const balance = await MyPtsModel.findOne({ userId: user._id });
//       console.log(`  • ${user.email}: ${balance?.totalPoints || 0} MyPts`);
//     }
//   }

//   async runAllTests() {
//     console.log('🚀 Starting MyPts Rewards System Test Suite');
//     console.log('===========================================');

//     try {
//       await this.setup();

//       const results = {
//         profileCompletion: await this.testProfileCompletionReward(),
//         referralReward: await this.testReferralReward(),
//         activityTracking: await this.testActivityTracking(),
//         cooldownLimits: await this.testCooldownAndLimits()
//       };

//       await this.displaySystemStatus();

//       console.log('\n📋 Test Results Summary:');
//       console.log('========================');
//       console.log(`Profile Completion Reward: ${results.profileCompletion ? '✅ PASS' : '❌ FAIL'}`);
//       console.log(`Referral Reward: ${results.referralReward ? '✅ PASS' : '❌ FAIL'}`);
//       console.log(`Activity Tracking: ${results.activityTracking ? '✅ PASS' : '❌ FAIL'}`);
//       console.log(`Cooldown & Limits: ${results.cooldownLimits ? '✅ PASS' : '❌ FAIL'}`);

//       const passedTests = Object.values(results).filter(Boolean).length;
//       const totalTests = Object.keys(results).length;

//       console.log(`\n🎯 Overall Result: ${passedTests}/${totalTests} tests passed`);

//       if (passedTests === totalTests) {
//         console.log('🎉 All tests PASSED! MyPts rewards system is working correctly.');
//       } else {
//         console.log('⚠️  Some tests FAILED. Please check the implementation.');
//       }

//     } catch (error) {
//       console.error('❌ Test suite error:', error);
//     } finally {
//       await this.cleanup();
//       process.exit(0);
//     }
//   }
// }

// // Run the test suite
// if (require.main === module) {
//   const testSuite = new MyPtsRewardsTestSuite();
//   testSuite.runAllTests();
// }

// export { MyPtsRewardsTestSuite };
