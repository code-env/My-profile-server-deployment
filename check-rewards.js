const mongoose = require('mongoose');

// Connect to database
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
const ActivityRewardSchema = new mongoose.Schema({
  activityType: String,
  description: String,
  category: String,
  pointsRewarded: Number,
  cooldownPeriod: Number,
  maxRewardsPerDay: Number,
  isEnabled: Boolean
}, { timestamps: true });

const MyPtsSchema = new mongoose.Schema({
  profileId: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile' },
  balance: Number,
  lifetimeEarned: Number,
  lifetimeSpent: Number,
  lastTransaction: Date
}, { timestamps: true });

const ActivityRewardModel = mongoose.model('ActivityReward', ActivityRewardSchema);
const MyPtsModel = mongoose.model('MyPts', MyPtsSchema);

async function checkRewardsSystem() {
  try {
    await connectToDatabase();
    
    console.log('\n🔍 Checking Activity Rewards Configuration...');
    const rewards = await ActivityRewardModel.find({});
    console.log(`Found ${rewards.length} activity rewards configured`);
    
    if (rewards.length === 0) {
      console.log('❌ NO ACTIVITY REWARDS CONFIGURED! This is the main issue.');
      console.log('   Profile creation and referral rewards cannot work without activity reward configuration.');
    } else {
      console.log('\n📋 Configured Activity Rewards:');
      rewards.forEach(reward => {
        console.log(`  • ${reward.activityType}: ${reward.pointsRewarded} pts`);
        console.log(`    - Description: ${reward.description}`);
        console.log(`    - Enabled: ${reward.isEnabled ? '✅' : '❌'}`);
        console.log(`    - Category: ${reward.category}`);
        console.log(`    - Cooldown: ${reward.cooldownPeriod || 0}ms`);
        console.log(`    - Max per day: ${reward.maxRewardsPerDay || 'unlimited'}`);
        console.log('');
      });
    }
    
    console.log('\n💰 Checking MyPts Balances...');
    const myPtsEntries = await MyPtsModel.find({}).limit(10);
    console.log(`Found ${myPtsEntries.length} MyPts entries (showing first 10)`);
    
    if (myPtsEntries.length === 0) {
      console.log('❌ No MyPts entries found - no profiles have MyPts balances');
    } else {
      myPtsEntries.forEach((entry, index) => {
        console.log(`  ${index + 1}. Profile ${entry.profileId}`);
        console.log(`     Balance: ${entry.balance} MyPts`);
        console.log(`     Lifetime Earned: ${entry.lifetimeEarned} MyPts`);
        console.log(`     Last Transaction: ${entry.lastTransaction || 'Never'}`);
        console.log('');
      });
    }
    
    console.log('\n📊 Summary:');
    console.log(`  Activity Rewards: ${rewards.length} configured`);
    console.log(`  MyPts Entries: ${myPtsEntries.length} profiles with balances`);
    
    if (rewards.length === 0) {
      console.log('\n🔧 SOLUTION: Need to seed activity rewards first!');
      console.log('   Run: npm run seed:activity-rewards');
    }
    
  } catch (error) {
    console.error('❌ Error checking rewards system:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

checkRewardsSystem();
