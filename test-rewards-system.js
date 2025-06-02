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
const UserSchema = new mongoose.Schema({
  email: String,
  username: String,
  fullName: String,
  password: String,
  dateOfBirth: Date,
  phoneNumber: String,
  countryOfResidence: String,
  accountType: String,
  accountCategory: String,
  verificationMethod: String,
  isEmailVerified: { type: Boolean, default: false },
  isPhoneVerified: { type: Boolean, default: false },
  tempReferralCode: String,
  verificationData: {
    otp: String,
    otpExpiry: Date,
    attempts: Number,
    lastAttempt: Date
  }
}, { timestamps: true });

const ProfileSchema = new mongoose.Schema({
  profileInformation: {
    creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    username: String,
    title: String
  },
  profileCategory: String,
  profileType: String,
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
  metadata: Object,
  referenceId: String
}, { timestamps: true });

const ProfileReferralSchema = new mongoose.Schema({
  profileId: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile' },
  referralCode: String,
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile' },
  earnedPoints: { type: Number, default: 0 },
  pendingPoints: { type: Number, default: 0 },
  totalReferrals: { type: Number, default: 0 },
  successfulReferrals: { type: Number, default: 0 },
  referredProfiles: [{
    profileId: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile' },
    date: { type: Date, default: Date.now },
    hasReachedThreshold: { type: Boolean, default: false }
  }]
}, { timestamps: true });

const UserActivitySchema = new mongoose.Schema({
  profileId: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile' },
  activityType: String,
  timestamp: Date,
  MyPtsEarned: Number,
  metadata: Object
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);
const Profile = mongoose.model('Profile', ProfileSchema);
const MyPts = mongoose.model('MyPts', MyPtsSchema);
const MyPtsTransaction = mongoose.model('MyPtsTransaction', MyPtsTransactionSchema);
const ProfileReferral = mongoose.model('ProfileReferral', ProfileReferralSchema);
const UserActivity = mongoose.model('UserActivity', UserActivitySchema);

async function testRewardSystem() {
  try {
    await connectToDatabase();
    
    console.log('\n🧪 Testing MyPts Reward System...');
    console.log('=====================================');
    
    // Clean up any existing test data
    await User.deleteMany({ email: { $regex: /test.*@rewards\.test/ } });
    await Profile.deleteMany({ 'profileInformation.username': { $regex: /test.*user/ } });
    await MyPts.deleteMany({});
    await MyPtsTransaction.deleteMany({});
    await ProfileReferral.deleteMany({});
    await UserActivity.deleteMany({});
    
    console.log('✅ Cleaned up existing test data');
    
    // Test 1: Profile Creation Reward
    console.log('\n📝 Test 1: Profile Creation Reward');
    console.log('----------------------------------');
    
    // Create a test user
    const testUser = await User.create({
      email: 'testuser@rewards.test',
      username: 'testuser',
      fullName: 'Test User',
      password: 'hashedpassword',
      dateOfBirth: new Date('1990-01-01'),
      phoneNumber: '+1234567890',
      countryOfResidence: 'US',
      accountType: 'personal',
      accountCategory: 'individual',
      verificationMethod: 'email',
      isEmailVerified: true,
      isPhoneVerified: true
    });
    
    console.log(`✅ Created test user: ${testUser.email}`);
    
    // Create a test profile
    const testProfile = await Profile.create({
      profileInformation: {
        creator: testUser._id,
        username: 'testuser',
        title: 'Test User Profile'
      },
      profileCategory: 'personal',
      profileType: 'individual'
    });
    
    console.log(`✅ Created test profile: ${testProfile._id}`);
    
    // Manually trigger profile completion reward (simulating the actual flow)
    const ActivityTrackingService = require('./src/services/activity-tracking.service').ActivityTrackingService;
    const activityService = new ActivityTrackingService();
    
    const profileReward = await activityService.trackActivity(
      testProfile._id,
      'profile_completion',
      {
        userId: testUser._id.toString(),
        profileId: testProfile._id.toString(),
        timestamp: new Date(),
        description: 'Profile creation completed'
      }
    );
    
    console.log(`📊 Profile completion reward result:`, profileReward);
    
    // Check MyPts balance
    const myPtsBalance = await MyPts.findOne({ profileId: testProfile._id });
    console.log(`💰 MyPts balance after profile creation: ${myPtsBalance?.balance || 0} MyPts`);
    
    if (myPtsBalance && myPtsBalance.balance >= 50) {
      console.log('✅ Profile creation reward: PASSED');
    } else {
      console.log('❌ Profile creation reward: FAILED');
    }
    
    // Test 2: Referral Reward
    console.log('\n🔗 Test 2: Referral Reward');
    console.log('---------------------------');
    
    // Create referrer profile with referral code
    const referrerUser = await User.create({
      email: 'referrer@rewards.test',
      username: 'referrer',
      fullName: 'Referrer User',
      password: 'hashedpassword',
      dateOfBirth: new Date('1985-01-01'),
      phoneNumber: '+1234567891',
      countryOfResidence: 'US',
      accountType: 'personal',
      accountCategory: 'individual',
      verificationMethod: 'email',
      isEmailVerified: true,
      isPhoneVerified: true
    });
    
    const referrerProfile = await Profile.create({
      profileInformation: {
        creator: referrerUser._id,
        username: 'referrer',
        title: 'Referrer Profile'
      },
      profileCategory: 'personal',
      profileType: 'individual'
    });
    
    // Create referral record for referrer
    const referrerReferral = await ProfileReferral.create({
      profileId: referrerProfile._id,
      referralCode: 'TEST123'
    });
    
    console.log(`✅ Created referrer with code: ${referrerReferral.referralCode}`);
    
    // Create referred user with referral code
    const referredUser = await User.create({
      email: 'referred@rewards.test',
      username: 'referred',
      fullName: 'Referred User',
      password: 'hashedpassword',
      dateOfBirth: new Date('1992-01-01'),
      phoneNumber: '+1234567892',
      countryOfResidence: 'US',
      accountType: 'personal',
      accountCategory: 'individual',
      verificationMethod: 'email',
      isEmailVerified: true,
      isPhoneVerified: true,
      tempReferralCode: 'TEST123'
    });
    
    const referredProfile = await Profile.create({
      profileInformation: {
        creator: referredUser._id,
        username: 'referred',
        title: 'Referred Profile'
      },
      profileCategory: 'personal',
      profileType: 'individual'
    });
    
    console.log(`✅ Created referred user with referral code: TEST123`);
    
    // Manually trigger referral rewards
    const ProfileReferralService = require('./src/services/profile-referral.service').ProfileReferralService;
    
    // Process the referral
    const referralProcessed = await ProfileReferralService.processReferral(
      referredProfile._id,
      referrerProfile._id
    );
    
    console.log(`📊 Referral processing result: ${referralProcessed}`);
    
    if (referralProcessed) {
      // Award referrer
      const referrerReward = await activityService.trackActivity(
        referrerProfile._id,
        'referral',
        {
          referredUserId: referredUser._id.toString(),
          referredProfileId: referredProfile._id.toString(),
          referralCode: 'TEST123',
          timestamp: new Date(),
          description: 'Successfully referred a new user'
        }
      );
      
      // Award referred user
      const referredReward = await activityService.trackActivity(
        referredProfile._id,
        'referral',
        {
          referrerProfileId: referrerProfile._id.toString(),
          referralCode: 'TEST123',
          timestamp: new Date(),
          description: 'Joined using a referral code'
        }
      );
      
      console.log(`📊 Referrer reward result:`, referrerReward);
      console.log(`📊 Referred reward result:`, referredReward);
      
      // Check balances
      const referrerBalance = await MyPts.findOne({ profileId: referrerProfile._id });
      const referredBalance = await MyPts.findOne({ profileId: referredProfile._id });
      
      console.log(`💰 Referrer balance: ${referrerBalance?.balance || 0} MyPts`);
      console.log(`💰 Referred balance: ${referredBalance?.balance || 0} MyPts`);
      
      if (referrerBalance && referrerBalance.balance >= 100 && referredBalance && referredBalance.balance >= 100) {
        console.log('✅ Referral rewards: PASSED');
      } else {
        console.log('❌ Referral rewards: FAILED');
      }
    } else {
      console.log('❌ Referral processing failed');
    }
    
    // Summary
    console.log('\n📊 Test Summary');
    console.log('===============');
    
    const allMyPts = await MyPts.find({});
    const allTransactions = await MyPtsTransaction.find({});
    const allActivities = await UserActivity.find({});
    
    console.log(`Total MyPts entries: ${allMyPts.length}`);
    console.log(`Total transactions: ${allTransactions.length}`);
    console.log(`Total activities: ${allActivities.length}`);
    
    allMyPts.forEach((entry, index) => {
      console.log(`  ${index + 1}. Profile ${entry.profileId}: ${entry.balance} MyPts (lifetime: ${entry.lifetimeEarned})`);
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Database disconnected');
    process.exit(0);
  }
}

testRewardSystem();
