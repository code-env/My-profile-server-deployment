// filepath: /home/marco/Videos/mm/m/My-profile-server-deployment/src/scripts/fix-profile-completion-status.ts
/**
 * Script to fix isProfileComplete field for users who have all required fields
 * but the flag was never set to true
 *
 * Run with: ts-node src/scripts/fix-profile-completion-status.ts
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { User } from '../models/User';

dotenv.config();

async function connectToDatabase() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('MONGODB_URI environment variable is not set');
      process.exit(1);
    }
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

async function fixProfileCompletionStatus() {
  try {
    console.log('Starting profile completion status fix...');

    // Find all users where isProfileComplete is false but all required fields are present
    const usersToFix = await User.find({
      isProfileComplete: false,
      dateOfBirth: { $exists: true, $ne: null },
      countryOfResidence: { $exists: true, $ne: null, $ne: '' },
      phoneNumber: { $exists: true, $ne: null, $ne: '' }
    });

    console.log(`Found ${usersToFix.length} users with incomplete profile status but all required fields present`);

    let fixedCount = 0;

    for (const user of usersToFix) {
      try {
        console.log(`Fixing user: ${user.email} (${user._id})`);

        // Log current state
        console.log(`  Current state:`);
        console.log(`    dateOfBirth: ${user.dateOfBirth}`);
        console.log(`    countryOfResidence: ${user.countryOfResidence}`);
        console.log(`    phoneNumber: ${user.phoneNumber}`);
        console.log(`    isProfileComplete: ${user.isProfileComplete}`);

        // Update the isProfileComplete flag
        user.isProfileComplete = true;
        await user.save();

        console.log(`  ✅ Fixed profile completion status for user ${user.email}`);
        fixedCount++;
      } catch (error) {
        console.error(`  ❌ Error fixing user ${user.email}:`, error);
      }
    }

    console.log(`\n=== Summary ===`);
    console.log(`Total users checked: ${usersToFix.length}`);
    console.log(`Successfully fixed: ${fixedCount}`);
    console.log(`Errors: ${usersToFix.length - fixedCount}`);

  } catch (error) {
    console.error('Error fixing profile completion status:', error);
  }
}

async function main() {
  await connectToDatabase();
  await fixProfileCompletionStatus();

  // Disconnect from MongoDB
  await mongoose.disconnect();
  console.log('Disconnected from MongoDB');
}

main().catch(console.error);
