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

const MyPtsHubSchema = new mongoose.Schema({
  totalSupply: Number,
  circulatingSupply: Number,
  reserveSupply: Number,
  holdingSupply: Number,
  maxSupply: Number,
  valuePerMyPt: Number,
  lastAdjustment: Date
}, { timestamps: true });

const MyPts = mongoose.model('MyPts', MyPtsSchema);
const MyPtsTransaction = mongoose.model('MyPtsTransaction', MyPtsTransactionSchema);
const UserActivity = mongoose.model('UserActivity', UserActivitySchema);
const MyPtsHub = mongoose.model('MyPtsHub', MyPtsHubSchema);

async function checkAfterSignup() {
  try {
    await connectToDatabase();
    
    console.log('\n🔍 Checking System State After Signup...');
    console.log('=========================================');
    
    const referrerProfileId = '6823e4176d60f01d408e0256'; // Referrer profile
    const newProfileId = '683cee9bd4b046d1f3bb12dc'; // Your new profile
    
    console.log(`\n👤 Checking Referrer Profile: ${referrerProfileId}`);
    console.log(`👤 Checking New Profile: ${newProfileId}`);
    
    // Check MyPts entries for both profiles
    const referrerMyPts = await MyPts.findOne({ profileId: referrerProfileId });
    const newUserMyPts = await MyPts.findOne({ profileId: newProfileId });
    
    console.log('\n💰 MyPts Balances:');
    console.log(`  Referrer: ${referrerMyPts ? referrerMyPts.balance + ' MyPts' : 'No MyPts entry found'}`);
    console.log(`  New User: ${newUserMyPts ? newUserMyPts.balance + ' MyPts' : 'No MyPts entry found'}`);
    
    // Check transactions
    const referrerTransactions = await MyPtsTransaction.find({ profileId: referrerProfileId });
    const newUserTransactions = await MyPtsTransaction.find({ profileId: newProfileId });
    
    console.log('\n📝 Transactions:');
    console.log(`  Referrer: ${referrerTransactions.length} transactions`);
    console.log(`  New User: ${newUserTransactions.length} transactions`);
    
    if (referrerTransactions.length > 0) {
      referrerTransactions.forEach((tx, index) => {
        console.log(`    ${index + 1}. ${tx.type}: ${tx.amount} MyPts - ${tx.description}`);
      });
    }
    
    if (newUserTransactions.length > 0) {
      newUserTransactions.forEach((tx, index) => {
        console.log(`    ${index + 1}. ${tx.type}: ${tx.amount} MyPts - ${tx.description}`);
      });
    }
    
    // Check activities
    const referrerActivities = await UserActivity.find({ profileId: referrerProfileId });
    const newUserActivities = await UserActivity.find({ profileId: newProfileId });
    
    console.log('\n🎯 Activities:');
    console.log(`  Referrer: ${referrerActivities.length} activities`);
    console.log(`  New User: ${newUserActivities.length} activities`);
    
    if (referrerActivities.length > 0) {
      referrerActivities.forEach((activity, index) => {
        console.log(`    ${index + 1}. ${activity.activityType}: ${activity.MyPtsEarned} MyPts earned`);
      });
    }
    
    if (newUserActivities.length > 0) {
      newUserActivities.forEach((activity, index) => {
        console.log(`    ${index + 1}. ${activity.activityType}: ${activity.MyPtsEarned} MyPts earned`);
      });
    }
    
    // Check MyPts Hub state
    const hub = await MyPtsHub.findOne({});
    
    console.log('\n🏦 MyPts Hub State:');
    if (hub) {
      console.log(`  Total Supply: ${hub.totalSupply.toLocaleString()} MyPts`);
      console.log(`  Circulating Supply: ${hub.circulatingSupply.toLocaleString()} MyPts`);
      console.log(`  Reserve Supply: ${hub.reserveSupply.toLocaleString()} MyPts`);
      console.log(`  Holding Supply: ${hub.holdingSupply.toLocaleString()} MyPts`);
      console.log(`  Value per MyPt: $${hub.valuePerMyPt}`);
    } else {
      console.log('  ❌ No MyPts Hub found');
    }
    
    // Check recent activities (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentActivities = await UserActivity.find({
      timestamp: { $gte: oneHourAgo }
    }).sort({ timestamp: -1 });
    
    console.log(`\n⏰ Recent Activities (last hour): ${recentActivities.length}`);
    if (recentActivities.length > 0) {
      recentActivities.forEach((activity, index) => {
        console.log(`  ${index + 1}. ${activity.activityType} by ${activity.profileId}: ${activity.MyPtsEarned} MyPts`);
      });
    }
    
    // Summary
    console.log('\n📋 DIAGNOSIS:');
    console.log('=============');
    
    const hasReferrerReward = referrerMyPts && referrerMyPts.balance > 0;
    const hasNewUserReward = newUserMyPts && newUserMyPts.balance > 0;
    const hasActivities = recentActivities.length > 0;
    const hasTransactions = referrerTransactions.length > 0 || newUserTransactions.length > 0;
    
    if (!hasReferrerReward && !hasNewUserReward && !hasActivities && !hasTransactions) {
      console.log('❌ AUTOMATIC REWARD SYSTEM IS COMPLETELY BROKEN');
      console.log('   - No MyPts awarded to referrer');
      console.log('   - No MyPts awarded to new user');
      console.log('   - No activities recorded');
      console.log('   - No transactions created');
      console.log('   - Referral tracking works, but rewards do not');
      console.log('\n🔧 REQUIRED FIX:');
      console.log('   The ActivityTrackingService.trackActivity() method needs to be fixed');
      console.log('   to properly move tokens from MyPts Hub and award rewards.');
    } else {
      console.log('✅ Some parts of the reward system are working');
    }
    
  } catch (error) {
    console.error('❌ Error checking system state:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Database disconnected');
    process.exit(0);
  }
}

checkAfterSignup();
