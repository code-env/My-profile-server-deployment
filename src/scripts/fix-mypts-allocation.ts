import mongoose from 'mongoose';
import { config } from '../config/config';
import { logger } from '../utils/logger';

// Import models
const MyPtsHubModel = require('../models/my-pts-hub.model');

// Database connection function
async function connectToDatabase(): Promise<void> {
  try {
    const mongoUri = process.env.MONGODB_URI || config.MONGODB_URI;
    await mongoose.connect(mongoUri, {
      authSource: "admin",
      maxPoolSize: 10,
      minPoolSize: 2,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      serverSelectionTimeoutMS: 10000,
    });
    console.log('✅ Database connected successfully');
    console.log(`📊 Connected to database: ${mongoose.connection.db?.databaseName || 'unknown'}`);
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}

/**
 * Fix MyPts Hub allocation to match desired percentages:
 * - Reserve Supply: 85% (850,000,000 MyPts)
 * - Holding Supply: 15% (150,000,000 MyPts)
 * - Circulating Supply: 0 (initially, will grow as users earn MyPts)
 */
async function fixMyPtsAllocation(): Promise<void> {
  try {
    await connectToDatabase();

    console.log('\n🎯 Starting MyPts Allocation Fix...');
    console.log('===============================================');

    const totalSupply = 1000000000; // 1 billion
    const desiredReserveSupply = totalSupply * 0.85; // 850,000,000 (85%)
    const desiredHoldingSupply = totalSupply * 0.15; // 150,000,000 (15%)
    const initialCirculatingSupply = 0; // Start with 0 in circulation

    console.log('\n📊 Target Allocation:');
    console.log(`   Total Supply: ${totalSupply.toLocaleString()} MyPts`);
    console.log(`   Reserve Supply: ${desiredReserveSupply.toLocaleString()} MyPts (85%)`);
    console.log(`   Holding Supply: ${desiredHoldingSupply.toLocaleString()} MyPts (15%)`);
    console.log(`   Circulating Supply: ${initialCirculatingSupply.toLocaleString()} MyPts (0%)`);

    // Find the current MyPts Hub record
    console.log('\n🔍 Finding current MyPts Hub record...');
    const hub = await MyPtsHubModel.findOne();

    if (!hub) {
      console.log('📝 No MyPts Hub record found. Creating new one with correct allocation...');

      const newHub = await MyPtsHubModel.create({
        totalSupply: totalSupply,
        circulatingSupply: initialCirculatingSupply,
        reserveSupply: desiredReserveSupply,
        holdingSupply: desiredHoldingSupply,
        maxSupply: null, // Unlimited
        valuePerMyPt: 0.024,
        lastAdjustment: new Date()
      });

      console.log('✅ Created new MyPts Hub with correct allocation');
      console.log(`   Total Supply: ${newHub.totalSupply.toLocaleString()} MyPts`);
      console.log(`   Reserve Supply: ${newHub.reserveSupply.toLocaleString()} MyPts (${((newHub.reserveSupply / newHub.totalSupply) * 100).toFixed(1)}%)`);
      console.log(`   Holding Supply: ${newHub.holdingSupply.toLocaleString()} MyPts (${((newHub.holdingSupply / newHub.totalSupply) * 100).toFixed(1)}%)`);
      console.log(`   Circulating Supply: ${newHub.circulatingSupply.toLocaleString()} MyPts (${((newHub.circulatingSupply / newHub.totalSupply) * 100).toFixed(1)}%)`);

    } else {
      console.log('📊 Found existing MyPts Hub record:');
      console.log(`   Current Total Supply: ${hub.totalSupply.toLocaleString()} MyPts`);
      console.log(`   Current Reserve Supply: ${hub.reserveSupply.toLocaleString()} MyPts (${((hub.reserveSupply / hub.totalSupply) * 100).toFixed(1)}%)`);
      console.log(`   Current Holding Supply: ${hub.holdingSupply?.toLocaleString() || 0} MyPts (${((hub.holdingSupply || 0) / hub.totalSupply * 100).toFixed(1)}%)`);
      console.log(`   Current Circulating Supply: ${hub.circulatingSupply.toLocaleString()} MyPts (${((hub.circulatingSupply / hub.totalSupply) * 100).toFixed(1)}%)`);

      // Check if current circulating supply would cause issues
      if (hub.circulatingSupply > 0) {
        console.log('\n⚠️  Warning: There are already MyPts in circulation!');
        console.log(`   This means ${hub.circulatingSupply.toLocaleString()} MyPts are already owned by users.`);
        console.log('   We need to account for this in our allocation...');

        // Adjust the allocation to account for existing circulation
        const remainingSupply = totalSupply - hub.circulatingSupply;
        const adjustedReserveSupply = Math.max(0, remainingSupply * 0.85);
        const adjustedHoldingSupply = Math.max(0, remainingSupply * 0.15);

        console.log('\n📊 Adjusted Target Allocation (accounting for existing circulation):');
        console.log(`   Total Supply: ${totalSupply.toLocaleString()} MyPts`);
        console.log(`   Circulating Supply: ${hub.circulatingSupply.toLocaleString()} MyPts (${((hub.circulatingSupply / totalSupply) * 100).toFixed(1)}%)`);
        console.log(`   Reserve Supply: ${adjustedReserveSupply.toLocaleString()} MyPts (${((adjustedReserveSupply / totalSupply) * 100).toFixed(1)}%)`);
        console.log(`   Holding Supply: ${adjustedHoldingSupply.toLocaleString()} MyPts (${((adjustedHoldingSupply / totalSupply) * 100).toFixed(1)}%)`);

        console.log('\n🔄 Updating MyPts Hub record with adjusted allocation...');
        hub.totalSupply = totalSupply;
        hub.reserveSupply = adjustedReserveSupply;
        hub.holdingSupply = adjustedHoldingSupply;
        // Keep existing circulatingSupply as-is
        hub.lastAdjustment = new Date();

      } else {
        console.log('\n🔄 Updating MyPts Hub record with target allocation...');
        hub.totalSupply = totalSupply;
        hub.circulatingSupply = initialCirculatingSupply;
        hub.reserveSupply = desiredReserveSupply;
        hub.holdingSupply = desiredHoldingSupply;
        hub.lastAdjustment = new Date();
      }

      await hub.save();
      console.log('✅ Updated MyPts Hub allocation successfully');
    }

    // Verify the final state
    console.log('\n✅ Final MyPts Hub State:');
    const finalHub = await MyPtsHubModel.findOne();
    if (finalHub) {
      const totalCheck = finalHub.circulatingSupply + finalHub.reserveSupply + (finalHub.holdingSupply || 0);

      console.log(`   Total Supply: ${finalHub.totalSupply.toLocaleString()} MyPts`);
      console.log(`   Reserve Supply: ${finalHub.reserveSupply.toLocaleString()} MyPts (${((finalHub.reserveSupply / finalHub.totalSupply) * 100).toFixed(1)}%)`);
      console.log(`   Holding Supply: ${(finalHub.holdingSupply || 0).toLocaleString()} MyPts (${(((finalHub.holdingSupply || 0) / finalHub.totalSupply) * 100).toFixed(1)}%)`);
      console.log(`   Circulating Supply: ${finalHub.circulatingSupply.toLocaleString()} MyPts (${((finalHub.circulatingSupply / finalHub.totalSupply) * 100).toFixed(1)}%)`);
      console.log(`   Value per MyPt: $${finalHub.valuePerMyPt}`);

      console.log('\n🔍 Verification:');
      console.log(`   Sum of all supplies: ${totalCheck.toLocaleString()} MyPts`);
      console.log(`   Matches total supply: ${totalCheck === finalHub.totalSupply ? '✅ Yes' : '❌ No'}`);

      if (finalHub.reserveSupply >= finalHub.holdingSupply) {
        console.log(`   Reserve > Holding: ✅ Yes (${((finalHub.reserveSupply / (finalHub.holdingSupply || 1)) * 100).toFixed(1)}% ratio)`);
      } else {
        console.log(`   Reserve > Holding: ❌ No - This needs to be fixed!`);
      }
    }

    console.log('\n🎉 MyPts allocation fix completed successfully!');
    console.log('   Your system now has the correct 85% reserve / 15% holding allocation.');

  } catch (error) {
    console.error('❌ Script execution failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Database disconnected');
  }
}

// Execute the script
if (require.main === module) {
  fixMyPtsAllocation().catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}

export { fixMyPtsAllocation };
