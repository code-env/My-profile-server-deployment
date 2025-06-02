const mongoose = require('mongoose');

async function previewRetroactiveRewards() {
  try {
    // Use the exact same connection string as the server
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

    // Find orphaned profiles (no corresponding user)
    const orphanedProfiles = allProfiles.filter(profile => {
      const creatorId = profile.profileInformation?.creator?.toString();
      return !creatorId || !validUserIds.has(creatorId);
    });

    console.log(`✅ Profiles with valid user accounts: ${profilesWithValidUsers.length}`);
    console.log(`❌ Orphaned profiles (no user account): ${orphanedProfiles.length}`);

    if (orphanedProfiles.length > 0) {
      console.log('\n🚨 Orphaned profiles found:');
      orphanedProfiles.slice(0, 5).forEach((profile, index) => {
        console.log(`  ${index + 1}. ${profile.profileInformation?.username || 'Unknown'}`);
        console.log(`     Profile ID: ${profile._id}`);
        console.log(`     Creator ID: ${profile.profileInformation?.creator || 'Missing'}`);
        console.log('');
      });
      if (orphanedProfiles.length > 5) {
        console.log(`     ... and ${orphanedProfiles.length - 5} more orphaned profiles`);
      }
    }

    // Find eligible profiles (no MyPts rewards yet AND has valid user account)
    const eligibleProfiles = profilesWithValidUsers.filter(profile => {
      const currentBalance = profile.ProfileMypts?.currentBalance || 0;
      const lifetimeMypts = profile.ProfileMypts?.lifetimeMypts || 0;
      return currentBalance === 0 && lifetimeMypts === 0;
    });

    console.log(`\n🎯 Eligible profiles for retroactive rewards: ${eligibleProfiles.length}`);
    console.log(`💰 Total MyPts to be awarded: ${eligibleProfiles.length * 100} MyPts`);

    if (eligibleProfiles.length > 0) {
      console.log('\n📋 Sample of eligible profiles:');
      eligibleProfiles.slice(0, 10).forEach((profile, index) => {
        console.log(`  ${index + 1}. ${profile.profileInformation?.username || 'Unknown'}`);
        console.log(`     Profile ID: ${profile._id}`);
        console.log(`     Created: ${profile.createdAt}`);
        console.log(`     Current Balance: ${profile.ProfileMypts?.currentBalance || 0}`);
        console.log(`     Lifetime MyPts: ${profile.ProfileMypts?.lifetimeMypts || 0}`);
        console.log('');
      });

      if (eligibleProfiles.length > 10) {
        console.log(`     ... and ${eligibleProfiles.length - 10} more profiles`);
      }
    }

    // Show profiles that already have MyPts (will be skipped)
    const profilesWithMyPts = allProfiles.filter(profile => {
      const currentBalance = profile.ProfileMypts?.currentBalance || 0;
      const lifetimeMypts = profile.ProfileMypts?.lifetimeMypts || 0;
      return currentBalance > 0 || lifetimeMypts > 0;
    });

    console.log(`\n✅ Profiles already with MyPts (will be skipped): ${profilesWithMyPts.length}`);

    if (profilesWithMyPts.length > 0) {
      console.log('\n📋 Sample of profiles with existing MyPts:');
      profilesWithMyPts.slice(0, 5).forEach((profile, index) => {
        console.log(`  ${index + 1}. ${profile.profileInformation?.username || 'Unknown'}`);
        console.log(`     Current Balance: ${profile.ProfileMypts?.currentBalance || 0}`);
        console.log(`     Lifetime MyPts: ${profile.ProfileMypts?.lifetimeMypts || 0}`);
        console.log('');
      });
    }

    // Check MyPts Hub reserves
    const myPtsHub = await mongoose.connection.db.collection('myptshubs').findOne({});
    if (myPtsHub) {
      console.log('\n💰 MyPts Hub Status:');
      console.log(`   Reserve Supply: ${myPtsHub.reserveSupply?.toLocaleString() || 0} MyPts`);
      console.log(`   Circulating Supply: ${myPtsHub.circulatingSupply?.toLocaleString() || 0} MyPts`);
      console.log(`   Total Supply: ${myPtsHub.totalSupply?.toLocaleString() || 0} MyPts`);

      const requiredMyPts = eligibleProfiles.length * 100;
      const hasEnoughReserves = myPtsHub.reserveSupply >= requiredMyPts;

      console.log(`\n🔍 Reserve Check:`);
      console.log(`   Required for rewards: ${requiredMyPts.toLocaleString()} MyPts`);
      console.log(`   Available reserves: ${myPtsHub.reserveSupply?.toLocaleString() || 0} MyPts`);
      console.log(`   Sufficient reserves: ${hasEnoughReserves ? '✅ YES' : '❌ NO'}`);

      if (!hasEnoughReserves) {
        console.log(`   ⚠️  WARNING: Insufficient reserves! Need ${(requiredMyPts - myPtsHub.reserveSupply).toLocaleString()} more MyPts`);
      }
    } else {
      console.log('\n❌ MyPts Hub not found!');
    }

    console.log('\n📝 Summary:');
    console.log('===========');
    console.log(`• Total profiles: ${allProfiles.length}`);
    console.log(`• Eligible for rewards: ${eligibleProfiles.length}`);
    console.log(`• Already have MyPts: ${profilesWithMyPts.length}`);
    console.log(`• MyPts to award: ${eligibleProfiles.length * 100}`);

    if (eligibleProfiles.length > 0) {
      console.log('\n🚀 To run the retroactive rewards:');
      console.log('   npm run retroactive:platform-join');
    } else {
      console.log('\n✅ No action needed - all profiles already have MyPts rewards');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Database disconnected');
    process.exit(0);
  }
}

previewRetroactiveRewards();
