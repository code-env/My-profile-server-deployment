const mongoose = require('mongoose');

async function checkServerDatabase() {
  try {
    // Use the exact same connection string as the server
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/myprofile';
    console.log('🔗 Connecting with URI:', mongoUri);
    
    await mongoose.connect(mongoUri, {
      authSource: "admin",
      maxPoolSize: 10,
      minPoolSize: 2,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      serverSelectionTimeoutMS: 10000,
    });
    
    console.log('✅ Connected to database');
    console.log('📊 Database name:', mongoose.connection.db.databaseName);
    
    // List all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('\n📋 Collections in this database:');
    collections.forEach(col => {
      console.log(`  - ${col.name}`);
    });
    
    // Check specifically for activityrewards
    const activityRewardsExists = collections.find(col => col.name === 'activityrewards');
    console.log(`\n🎯 activityrewards collection: ${activityRewardsExists ? '✅ EXISTS' : '❌ NOT FOUND'}`);
    
    if (activityRewardsExists) {
      const count = await mongoose.connection.db.collection('activityrewards').countDocuments();
      console.log(`   Documents in activityrewards: ${count}`);
      
      if (count > 0) {
        const sample = await mongoose.connection.db.collection('activityrewards').findOne();
        console.log(`   Sample document:`, {
          activityType: sample.activityType,
          pointsRewarded: sample.pointsRewarded,
          isEnabled: sample.isEnabled,
          description: sample.description
        });
        
        // Test the exact query that's failing
        const profileCompletion = await mongoose.connection.db.collection('activityrewards').findOne({
          activityType: 'profile_completion'
        });
        console.log(`   profile_completion query result: ${profileCompletion ? '✅ FOUND' : '❌ NOT FOUND'}`);
      }
    }
    
    // Check what database our scripts were using
    console.log('\n🔍 Checking if scripts used a different database...');
    
    // Try connecting to the 'test' database (MongoDB default)
    const testDb = mongoose.connection.db.db('test');
    const testCollections = await testDb.listCollections().toArray();
    console.log('\n📋 Collections in "test" database:');
    testCollections.forEach(col => {
      console.log(`  - ${col.name}`);
    });
    
    const testActivityRewards = testCollections.find(col => col.name === 'activityrewards');
    if (testActivityRewards) {
      const testCount = await testDb.collection('activityrewards').countDocuments();
      console.log(`🎯 activityrewards in "test" database: ${testCount} documents`);
    }
    
    // Try the 'myprofile' database
    const myprofileDb = mongoose.connection.db.db('myprofile');
    const myprofileCollections = await myprofileDb.listCollections().toArray();
    console.log('\n📋 Collections in "myprofile" database:');
    myprofileCollections.forEach(col => {
      console.log(`  - ${col.name}`);
    });
    
    const myprofileActivityRewards = myprofileCollections.find(col => col.name === 'activityrewards');
    if (myprofileActivityRewards) {
      const myprofileCount = await myprofileDb.collection('activityrewards').countDocuments();
      console.log(`🎯 activityrewards in "myprofile" database: ${myprofileCount} documents`);
      
      if (myprofileCount > 0) {
        console.log('\n🚨 FOUND THE ISSUE!');
        console.log('   Activity rewards are in the "myprofile" database');
        console.log('   But the server is connecting to the default database');
        console.log('   This is why the server cannot find the activity rewards!');
        
        const profileCompletion = await myprofileDb.collection('activityrewards').findOne({
          activityType: 'profile_completion'
        });
        console.log(`   profile_completion in myprofile db: ${profileCompletion ? '✅ FOUND' : '❌ NOT FOUND'}`);
        if (profileCompletion) {
          console.log(`   Details:`, {
            activityType: profileCompletion.activityType,
            pointsRewarded: profileCompletion.pointsRewarded,
            isEnabled: profileCompletion.isEnabled,
            description: profileCompletion.description
          });
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Database disconnected');
    process.exit(0);
  }
}

checkServerDatabase();
