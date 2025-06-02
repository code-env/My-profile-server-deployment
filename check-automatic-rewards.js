const mongoose = require('mongoose');

async function connectToDatabase() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/myprofile';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to database');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

// Define schemas
const ProfileSchema = new mongoose.Schema({
  profileInformation: {
    creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    username: String,
    title: String
  },
  myPtsBalance: { type: Number, default: 0 },
  ProfileMypts: {
    currentBalance: { type: Number, default: 0 },
    lifetimeMypts: { type: Number, default: 0 }
  }
}, { timestamps: true });

const MyPtsSchema = new mongoose.Schema({
  profileId: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile' },
  balance: Number,
  lifetimeEarned: Number,
  lifetimeSpent: Number,
  lastTransaction: Date
}, { timestamps: true });

const MyPtsTransactionSchema = new mongoose.Schema({
  profileId: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile' },
  type: String,
  amount: Number,
  balance: Number,
  description: String,
  status: String,
  metadata: Object
}, { timestamps: true });

const UserActivitySchema = new mongoose.Schema({
  profileId: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile' },
  activityType: String,
  timestamp: Date,
  MyPtsEarned: Number,
  metadata: Object
}, { timestamps: true });

const Profile = mongoose.model('Profile', ProfileSchema);
const MyPts = mongoose.model('MyPts', MyPtsSchema);
const MyPtsTransaction = mongoose.model('MyPtsTransaction', MyPtsTransactionSchema);
const UserActivity = mongoose.model('UserActivity', UserActivitySchema);

async function checkAutomaticRewards() {
  try {
    await connectToDatabase();
    
    console.log('\n🔍 Checking Automatic Reward System Status...');
    console.log('==============================================');
    
    // Check recent profiles (created in last 24 hours)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentProfiles = await Profile.find({
      createdAt: { $gte: yesterday }
    }).limit(10);
    
    console.log(`\n📊 Recent Profiles (last 24h): ${recentProfiles.length}`);
    
    if (recentProfiles.length === 0) {
      console.log('ℹ️  No recent profiles found. The automatic system triggers when new profiles are created.');
    }
    
    // Check MyPts entries
    const myPtsEntries = await MyPts.find({}).limit(10);
    console.log(`\n💰 MyPts Entries: ${myPtsEntries.length}`);
    
    if (myPtsEntries.length === 0) {
      console.log('❌ No MyPts entries found - automatic rewards are not working');
    } else {
      console.log('✅ MyPts entries found - automatic rewards may be working');
      
      myPtsEntries.forEach((entry, index) => {
        console.log(`  ${index + 1}. Profile ${entry.profileId}: ${entry.balance} MyPts (lifetime: ${entry.lifetimeEarned})`);
      });
    }
    
    // Check recent transactions
    const recentTransactions = await MyPtsTransaction.find({
      createdAt: { $gte: yesterday }
    }).sort({ createdAt: -1 }).limit(10);
    
    console.log(`\n📝 Recent Transactions (last 24h): ${recentTransactions.length}`);
    
    if (recentTransactions.length === 0) {
      console.log('ℹ️  No recent transactions found.');
    } else {
      recentTransactions.forEach((tx, index) => {
        console.log(`  ${index + 1}. ${tx.type}: ${tx.amount} MyPts - ${tx.description}`);
      });
    }
    
    // Check recent activities
    const recentActivities = await UserActivity.find({
      timestamp: { $gte: yesterday }
    }).sort({ timestamp: -1 }).limit(10);
    
    console.log(`\n🎯 Recent Activities (last 24h): ${recentActivities.length}`);
    
    if (recentActivities.length === 0) {
      console.log('ℹ️  No recent activities found.');
    } else {
      recentActivities.forEach((activity, index) => {
        console.log(`  ${index + 1}. ${activity.activityType}: ${activity.MyPtsEarned} MyPts earned`);
      });
    }
    
    // Check for profile_completion activities
    const profileCompletionActivities = await UserActivity.find({
      activityType: 'profile_completion'
    }).limit(5);
    
    console.log(`\n🏁 Profile Completion Activities: ${profileCompletionActivities.length}`);
    
    if (profileCompletionActivities.length === 0) {
      console.log('❌ No profile completion activities found - automatic profile rewards not working');
    } else {
      console.log('✅ Profile completion activities found - automatic profile rewards working');
    }
    
    // Check for referral activities
    const referralActivities = await UserActivity.find({
      activityType: 'referral'
    }).limit(5);
    
    console.log(`\n🔗 Referral Activities: ${referralActivities.length}`);
    
    if (referralActivities.length === 0) {
      console.log('❌ No referral activities found - automatic referral rewards not working');
    } else {
      console.log('✅ Referral activities found - automatic referral rewards working');
    }
    
    // Summary
    console.log('\n📋 Automatic System Status Summary:');
    console.log('===================================');
    
    const hasMyPts = myPtsEntries.length > 0;
    const hasProfileRewards = profileCompletionActivities.length > 0;
    const hasReferralRewards = referralActivities.length > 0;
    const hasRecentActivity = recentActivities.length > 0;
    
    console.log(`MyPts System: ${hasMyPts ? '✅ ACTIVE' : '❌ INACTIVE'}`);
    console.log(`Profile Rewards: ${hasProfileRewards ? '✅ WORKING' : '❌ NOT WORKING'}`);
    console.log(`Referral Rewards: ${hasReferralRewards ? '✅ WORKING' : '❌ NOT WORKING'}`);
    console.log(`Recent Activity: ${hasRecentActivity ? '✅ ACTIVE' : '❌ INACTIVE'}`);
    
    if (!hasMyPts && !hasProfileRewards && !hasReferralRewards) {
      console.log('\n🔧 RECOMMENDATION:');
      console.log('The automatic reward system appears to be inactive.');
      console.log('This could be because:');
      console.log('1. No new profiles have been created recently');
      console.log('2. The reward system is not triggering properly');
      console.log('3. There are errors in the reward processing');
      console.log('\nTo test: Create a new user account and profile to see if rewards are awarded automatically.');
    } else {
      console.log('\n✅ The automatic reward system appears to be working!');
    }
    
  } catch (error) {
    console.error('❌ Error checking automatic rewards:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Database disconnected');
    process.exit(0);
  }
}

checkAutomaticRewards();
