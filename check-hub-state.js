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

// Define MyPts Hub schema
const MyPtsHubSchema = new mongoose.Schema({
  totalSupply: Number,
  circulatingSupply: Number,
  reserveSupply: Number,
  holdingSupply: Number,
  maxSupply: Number,
  valuePerMyPt: Number,
  lastAdjustment: Date
}, { timestamps: true });

const MyPtsHub = mongoose.model('MyPtsHub', MyPtsHubSchema);

async function checkHubState() {
  try {
    await connectToDatabase();
    
    console.log('\n🏦 Checking MyPts Hub State...');
    console.log('================================');
    
    const hub = await MyPtsHub.findOne({});
    
    if (!hub) {
      console.log('❌ MyPts Hub not found! This is a critical issue.');
      console.log('   The hub needs to be initialized before rewards can work.');
      console.log('\n🔧 SOLUTION: Run the hub initialization script');
      console.log('   npm run init:mypts-hub');
    } else {
      console.log('✅ MyPts Hub found');
      console.log('\n📊 Hub State:');
      console.log(`  Total Supply: ${hub.totalSupply.toLocaleString()} MyPts`);
      console.log(`  Circulating Supply: ${hub.circulatingSupply.toLocaleString()} MyPts`);
      console.log(`  Reserve Supply: ${hub.reserveSupply.toLocaleString()} MyPts`);
      console.log(`  Holding Supply: ${hub.holdingSupply.toLocaleString()} MyPts`);
      console.log(`  Value per MyPt: $${hub.valuePerMyPt}`);
      console.log(`  Last Adjustment: ${hub.lastAdjustment || 'Never'}`);
      
      // Check if there are sufficient reserves for rewards
      const profileReward = 50; // Profile completion reward
      const referralReward = 100; // Referral reward
      const totalNeeded = profileReward + referralReward; // 150 MyPts for both rewards
      
      console.log('\n🔍 Reward Capacity Check:');
      console.log(`  Profile Completion Reward: ${profileReward} MyPts`);
      console.log(`  Referral Reward: ${referralReward} MyPts each`);
      console.log(`  Total Needed for Full Signup: ${totalNeeded} MyPts`);
      
      if (hub.reserveSupply >= totalNeeded) {
        console.log(`  ✅ Reserve has sufficient MyPts: ${hub.reserveSupply.toLocaleString()}`);
      } else if (hub.holdingSupply >= totalNeeded) {
        console.log(`  ⚠️  Reserve insufficient (${hub.reserveSupply}), but holding has enough (${hub.holdingSupply.toLocaleString()})`);
        console.log(`      System will automatically move from holding to circulation`);
      } else {
        console.log(`  ❌ Insufficient MyPts in both reserve (${hub.reserveSupply}) and holding (${hub.holdingSupply})`);
        console.log(`      System will need to issue new MyPts`);
      }
      
      // Calculate percentages
      const circulatingPercent = ((hub.circulatingSupply / hub.totalSupply) * 100).toFixed(2);
      const reservePercent = ((hub.reserveSupply / hub.totalSupply) * 100).toFixed(2);
      const holdingPercent = ((hub.holdingSupply / hub.totalSupply) * 100).toFixed(2);
      
      console.log('\n📈 Distribution:');
      console.log(`  Circulating: ${circulatingPercent}% of total supply`);
      console.log(`  Reserve: ${reservePercent}% of total supply`);
      console.log(`  Holding: ${holdingPercent}% of total supply`);
      
      // Health check
      console.log('\n🏥 Hub Health:');
      if (hub.reserveSupply > 0 || hub.holdingSupply > 0) {
        console.log('  ✅ Hub is healthy and ready for rewards');
      } else {
        console.log('  ❌ Hub has no reserves or holding - rewards will fail');
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking hub state:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Database disconnected');
    process.exit(0);
  }
}

checkHubState();
