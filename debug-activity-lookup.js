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

async function debugActivityLookup() {
  try {
    await connectToDatabase();
    
    console.log('\n🔍 Debugging Activity Reward Lookup...');
    console.log('=====================================');
    
    // Check all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('\n📋 Available Collections:');
    collections.forEach(col => {
      console.log(`  - ${col.name}`);
    });
    
    // Check ActivityReward collection specifically
    const activityRewardCollections = collections.filter(col => 
      col.name.toLowerCase().includes('activity') || 
      col.name.toLowerCase().includes('reward')
    );
    
    console.log('\n🎯 Activity/Reward Related Collections:');
    activityRewardCollections.forEach(col => {
      console.log(`  - ${col.name}`);
    });
    
    // Try different collection names
    const possibleCollectionNames = [
      'activityrewards',
      'ActivityRewards', 
      'activity_rewards',
      'ActivityReward',
      'activityReward'
    ];
    
    console.log('\n🔍 Testing Different Collection Names:');
    for (const collectionName of possibleCollectionNames) {
      try {
        const collection = mongoose.connection.db.collection(collectionName);
        const count = await collection.countDocuments();
        console.log(`  ${collectionName}: ${count} documents`);
        
        if (count > 0) {
          const sample = await collection.findOne();
          console.log(`    Sample document:`, sample);
        }
      } catch (error) {
        console.log(`  ${collectionName}: Error - ${error.message}`);
      }
    }
    
    // Test the exact query that's failing
    console.log('\n🧪 Testing Exact Query:');
    console.log('Query: { activityType: "profile_completion" }');
    
    for (const collectionName of possibleCollectionNames) {
      try {
        const collection = mongoose.connection.db.collection(collectionName);
        const result = await collection.findOne({ activityType: "profile_completion" });
        console.log(`  ${collectionName}:`, result ? 'FOUND' : 'NOT FOUND');
        if (result) {
          console.log(`    Result:`, {
            activityType: result.activityType,
            pointsRewarded: result.pointsRewarded,
            isEnabled: result.isEnabled,
            description: result.description
          });
        }
      } catch (error) {
        console.log(`  ${collectionName}: Error - ${error.message}`);
      }
    }
    
    // Test using the actual model
    console.log('\n🏗️ Testing with Mongoose Model:');
    
    // Define the schema and model inline to test
    const ActivityRewardSchema = new mongoose.Schema({
      activityType: String,
      description: String,
      category: String,
      pointsRewarded: Number,
      cooldownPeriod: Number,
      maxRewardsPerDay: Number,
      isEnabled: Boolean
    }, { timestamps: true });
    
    ActivityRewardSchema.statics.findByActivityType = function(activityType) {
      return this.findOne({ activityType });
    };
    
    const TestActivityRewardModel = mongoose.model('TestActivityReward', ActivityRewardSchema);
    
    try {
      const result = await TestActivityRewardModel.findByActivityType('profile_completion');
      console.log('  Using TestActivityRewardModel:', result ? 'FOUND' : 'NOT FOUND');
      if (result) {
        console.log('    Result:', {
          activityType: result.activityType,
          pointsRewarded: result.pointsRewarded,
          isEnabled: result.isEnabled,
          description: result.description
        });
      }
    } catch (error) {
      console.log('  TestActivityRewardModel Error:', error.message);
    }
    
    // Test with the original model name
    try {
      const OriginalActivityRewardModel = mongoose.model('ActivityReward', ActivityRewardSchema);
      const result = await OriginalActivityRewardModel.findByActivityType('profile_completion');
      console.log('  Using ActivityReward model:', result ? 'FOUND' : 'NOT FOUND');
      if (result) {
        console.log('    Result:', {
          activityType: result.activityType,
          pointsRewarded: result.pointsRewarded,
          isEnabled: result.isEnabled,
          description: result.description
        });
      }
    } catch (error) {
      console.log('  ActivityReward model Error:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Database disconnected');
    process.exit(0);
  }
}

debugActivityLookup();
