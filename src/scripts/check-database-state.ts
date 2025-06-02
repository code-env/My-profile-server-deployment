// #!/usr/bin/env ts-node

// import { connectToDatabase } from '../config/database';
// import { ActivityRewardModel } from '../models/gamification/activity-reward.model';
// import { MyPtsModel } from '../models/gamification/my-pts.model';
// import { ProfileModel } from '../models/profile.model';
// import { ProfileReferralModel } from '../models/profile-referral.model';

// async function checkDatabaseState() {
//   try {
//     console.log('🔍 Checking MyPts System Database State');
//     console.log('======================================');

//     await connectToDatabase();
//     console.log('✅ Database connected successfully\n');

//     // Check ActivityReward entries
//     console.log('🎯 Activity Rewards Configuration:');
//     console.log('-----------------------------------');
//     const rewards = await ActivityRewardModel.find().sort({ activityType: 1 });

//     if (rewards.length === 0) {
//       console.log('❌ No ActivityReward entries found in database');
//       console.log('💡 Run the seeding script: npm run seed:activity-rewards');
//     } else {
//       console.log(`✅ Found ${rewards.length} activity reward configurations:`);
//       rewards.forEach((reward, index) => {
//         console.log(`\n${index + 1}. ${reward.activityType}`);
//         console.log(`   Points: ${reward.pointsAwarded}`);
//         console.log(`   Description: ${reward.description}`);
//         console.log(`   Active: ${reward.isActive ? '✅' : '❌'}`);
//         console.log(`   Cooldown: ${reward.cooldownPeriod}ms`);
//         console.log(`   Daily Limit: ${reward.dailyLimit}`);
//         console.log(`   Max Per User: ${reward.maxRewardsPerUser || 'Unlimited'}`);
//       });
//     }

//     // Check MyPts balances
//     console.log('\n\n💰 MyPts Balances:');
//     console.log('------------------');
//     const myPtsEntries = await MyPtsModel.find().populate('userId', 'email username');

//     if (myPtsEntries.length === 0) {
//       console.log('❌ No MyPts balance entries found');
//     } else {
//       console.log(`✅ Found ${myPtsEntries.length} MyPts balance entries:`);
//       myPtsEntries.forEach((entry, index) => {
//         const user = entry.userId as any;
//         console.log(`${index + 1}. ${user?.email || 'Unknown'} (${user?.username || 'N/A'})`);
//         console.log(`   Total Points: ${entry.totalPoints}`);
//         console.log(`   Available Points: ${entry.availablePoints}`);
//         console.log(`   Lifetime Earned: ${entry.lifetimeEarned}`);
//         console.log(`   Last Updated: ${entry.updatedAt}`);
//       });
//     }

//     // Check Referrals
//     console.log('\n\n🤝 Profile Referrals:');
//     console.log('---------------------');
//     const referrals = await ProfileReferralModel.find()
//       .populate('referrerUserId', 'email username')
//       .populate('referredUserId', 'email username');

//     if (referrals.length === 0) {
//       console.log('❌ No referral entries found');
//     } else {
//       console.log(`✅ Found ${referrals.length} referral entries:`);
//       referrals.forEach((referral, index) => {
//         const referrer = referral.referrerUserId as any;
//         const referred = referral.referredUserId as any;
//         console.log(`${index + 1}. ${referrer?.email || 'Unknown'} → ${referred?.email || 'Unknown'}`);
//         console.log(`   Status: ${referral.status}`);
//         console.log(`   Milestone Level: ${referral.milestoneLevel}`);
//         console.log(`   Bonus Points: ${referral.bonusPointsAwarded}`);
//         console.log(`   Created: ${referral.createdAt}`);
//       });
//     }

//     // Check Profiles with referral codes
//     console.log('\n\n👥 User Profiles:');
//     console.log('-----------------');
//     const profiles = await ProfileModel.find({}, 'email username referralCode createdAt').sort({ createdAt: -1 });

//     if (profiles.length === 0) {
//       console.log('❌ No user profiles found');
//     } else {
//       console.log(`✅ Found ${profiles.length} user profiles:`);
//       profiles.slice(0, 10).forEach((profile, index) => {
//         console.log(`${index + 1}. ${profile.email} (@${profile.username})`);
//         console.log(`   Referral Code: ${profile.referralCode}`);
//         console.log(`   Created: ${profile.createdAt}`);
//       });

//       if (profiles.length > 10) {
//         console.log(`   ... and ${profiles.length - 10} more profiles`);
//       }
//     }

//     // System Summary
//     console.log('\n\n📊 System Summary:');
//     console.log('==================');
//     console.log(`Active Rewards: ${rewards.filter(r => r.isActive).length}/${rewards.length}`);
//     console.log(`Users with MyPts: ${myPtsEntries.length}`);
//     console.log(`Total Referrals: ${referrals.length}`);
//     console.log(`Total Users: ${profiles.length}`);

//     const totalPointsInSystem = myPtsEntries.reduce((sum, entry) => sum + entry.totalPoints, 0);
//     console.log(`Total MyPts in System: ${totalPointsInSystem}`);

//     console.log('\n✅ Database state check completed');

//   } catch (error) {
//     console.error('❌ Error checking database state:', error);
//   } finally {
//     process.exit(0);
//   }
// }

// // Run the database state check
// if (require.main === module) {
//   checkDatabaseState();
// }

// export { checkDatabaseState };
