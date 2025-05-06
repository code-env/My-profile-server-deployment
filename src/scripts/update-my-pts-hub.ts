import mongoose from 'mongoose';
import { config } from '../config/config';
import { MyPtsHubModel } from '../models/my-pts-hub.model';

/**
 * This script updates the MyPtsHub record to match the dashboard values:
 * 1. Total Supply: 1,000,000,000 (1 billion)
 * 2. Holding Supply: 150,000,000 (15% of total supply)
 * 3. Circulating Supply: 0 (no MyPts in circulation initially)
 * 4. Reserve Supply: 0 (no MyPts in reserve initially)
 */
async function updateMyPtsHub() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(config.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find the MyPtsHub record
    console.log('Finding MyPtsHub record...');
    const hub = await MyPtsHubModel.findOne();

    if (!hub) {
      console.error('No MyPtsHub record found. Creating a new one...');
      const newHub = await MyPtsHubModel.create({
        totalSupply: 1000000000,      // 1 billion
        circulatingSupply: 850000000, // 85% of total
        reserveSupply: 150000000,     // 15% of total (holding)
        maxSupply: null,              // Unlimited
        valuePerMyPt: 0.024,
        lastAdjustment: new Date()
      });
      console.log('Created new MyPtsHub record:', newHub);
    } else {
      console.log('Found existing MyPtsHub record:', hub);

      // Update the record
      console.log('Updating MyPtsHub record...');
      hub.totalSupply = 1000000000;      // 1 billion
      hub.circulatingSupply = 850000000; // 85% of total
      hub.reserveSupply = 150000000;     // 15% of total (holding)
      hub.lastAdjustment = new Date();

      await hub.save();
      console.log('MyPtsHub record updated successfully');
    }

    // Verify the update
    const updatedHub = await MyPtsHubModel.findOne();
    console.log('Updated MyPtsHub record:', updatedHub);

    console.log('MyPtsHub update completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error updating MyPtsHub:', error);
    process.exit(1);
  }
}

// Run the update function
updateMyPtsHub();
