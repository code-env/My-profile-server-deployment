const mongoose = require('mongoose');

async function runRetroactiveRewards() {
  try {
    // Use the exact same connection string as the preview script
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/myprofile';
    console.log('🔗 Connecting to database...');
    
    await mongoose.connect(mongoUri, {
      authSource: "admin",
      maxPoolSize: 10,
      minPoolSize: 2,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      serverSelectionTimeoutMS: 10000,
    });
    
    console.log('✅ Connected to database');
    console.log(`📊 Database name: ${mongoose.connection.db.databaseName}`);
    
    // Get all profiles and users
    const allProfiles = await mongoose.connection.db.collection('profiles').find({}).toArray();
    const allUsers = await mongoose.connection.db.collection('users').find({}).toArray();
    
    console.log(`\n📊 Total profiles in database: ${allProfiles.length}`);
    console.log(`📊 Total users in database: ${allUsers.length}`);
    
    // Create a set of valid user IDs for quick lookup
    const validUserIds = new Set(allUsers.map(user => user._id.toString()));
    
    // Find profiles with valid user accounts
    const profilesWithValidUsers = allProfiles.filter(profile => {
      const creatorId = profile.profileInformation?.creator?.toString();
      return creatorId && validUserIds.has(creatorId);
    });
    
    // Find eligible profiles (no MyPts rewards yet AND has valid user account)
    const eligibleProfiles = profilesWithValidUsers.filter(profile => {
      const currentBalance = profile.ProfileMypts?.currentBalance || 0;
      const lifetimeMypts = profile.ProfileMypts?.lifetimeMypts || 0;
      return currentBalance === 0 && lifetimeMypts === 0;
    });
    
    console.log(`✅ Profiles with valid user accounts: ${profilesWithValidUsers.length}`);
    console.log(`🎯 Eligible profiles for retroactive rewards: ${eligibleProfiles.length}`);
    console.log(`💰 Total MyPts to be awarded: ${eligibleProfiles.length * 100} MyPts`);
    
    if (eligibleProfiles.length === 0) {
      console.log('✅ No eligible profiles found. All profiles have already received rewards.');
      return;
    }
    
    // Show sample of eligible profiles
    console.log('\n📋 Eligible profiles to receive rewards:');
    eligibleProfiles.slice(0, 10).forEach((profile, index) => {
      console.log(`  ${index + 1}. ${profile.profileInformation?.username || 'Unknown'} (${profile._id})`);
      console.log(`     Created: ${profile.createdAt}`);
      console.log(`     User ID: ${profile.profileInformation?.creator}`);
    });
    
    if (eligibleProfiles.length > 10) {
      console.log(`     ... and ${eligibleProfiles.length - 10} more profiles`);
    }
    
    console.log(`\n🚀 Starting retroactive rewards for ${eligibleProfiles.length} profiles...`);
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    // Process profiles in batches
    const batchSize = 5;
    const totalBatches = Math.ceil(eligibleProfiles.length / batchSize);
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIndex = batchIndex * batchSize;
      const endIndex = Math.min(startIndex + batchSize, eligibleProfiles.length);
      const batch = eligibleProfiles.slice(startIndex, endIndex);
      
      console.log(`\n📦 Processing batch ${batchIndex + 1}/${totalBatches} (${batch.length} profiles)...`);
      
      for (const profile of batch) {
        try {
          console.log(`  🎯 Processing: ${profile.profileInformation?.username || 'Unknown'} (${profile._id})`);
          
          // Award 100 MyPts platform join bonus
          const result = await awardPlatformJoinBonus(profile._id, profile.profileInformation?.creator);
          
          if (result.success) {
            console.log(`    ✅ Awarded 100 MyPts to ${profile.profileInformation?.username || 'Unknown'}`);
            successCount++;
          } else {
            console.log(`    ❌ Failed to award MyPts: ${result.error}`);
            errorCount++;
            errors.push({
              profileId: profile._id.toString(),
              error: result.error
            });
          }
          
          // Small delay to avoid overwhelming the database
          await new Promise(resolve => setTimeout(resolve, 200));
          
        } catch (error) {
          console.error(`    ❌ Error processing profile ${profile._id}:`, error.message);
          errorCount++;
          errors.push({
            profileId: profile._id.toString(),
            error: error.message
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
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Database disconnected');
    process.exit(0);
  }
}

async function awardPlatformJoinBonus(profileId, userId) {
  try {
    // Create MyPts record if it doesn't exist
    let myPtsRecord = await mongoose.connection.db.collection('mypts').findOne({ profileId: new mongoose.Types.ObjectId(profileId) });
    
    if (!myPtsRecord) {
      myPtsRecord = {
        profileId: new mongoose.Types.ObjectId(profileId),
        balance: 0,
        lifetimeEarned: 0,
        transactions: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await mongoose.connection.db.collection('mypts').insertOne(myPtsRecord);
    }
    
    // Check if already has MyPts (double-check)
    if (myPtsRecord.balance > 0 || myPtsRecord.lifetimeEarned > 0) {
      return { success: false, error: 'Profile already has MyPts rewards' };
    }
    
    // Add 100 MyPts transaction
    const transaction = {
      _id: new mongoose.Types.ObjectId(),
      amount: 100,
      type: 'EARN_MYPTS',
      description: 'Retroactive platform join bonus',
      date: new Date(),
      metadata: {
        activityType: 'platform_join',
        isRetroactive: true
      }
    };
    
    // Update MyPts record
    await mongoose.connection.db.collection('mypts').updateOne(
      { profileId: new mongoose.Types.ObjectId(profileId) },
      {
        $set: {
          balance: 100,
          lifetimeEarned: 100,
          updatedAt: new Date()
        },
        $push: {
          transactions: transaction
        }
      }
    );
    
    // Update profile MyPts fields
    await mongoose.connection.db.collection('profiles').updateOne(
      { _id: new mongoose.Types.ObjectId(profileId) },
      {
        $set: {
          'ProfileMypts.currentBalance': 100,
          'ProfileMypts.lifetimeMypts': 100,
          updatedAt: new Date()
        }
      }
    );
    
    // Create activity record
    const activity = {
      _id: new mongoose.Types.ObjectId(),
      profileId: new mongoose.Types.ObjectId(profileId),
      userId: userId ? new mongoose.Types.ObjectId(userId) : null,
      activityType: 'platform_join',
      MyPtsEarned: 100,
      timestamp: new Date(),
      metadata: {
        description: 'Retroactive platform join bonus',
        isRetroactive: true
      }
    };
    
    await mongoose.connection.db.collection('useractivities').insertOne(activity);
    
    return { success: true };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Run the script
if (require.main === module) {
  runRetroactiveRewards().catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}

module.exports = { runRetroactiveRewards };
