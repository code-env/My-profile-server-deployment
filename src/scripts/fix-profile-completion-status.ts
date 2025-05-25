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

    // Get all users to check their completion status
    const allUsers = await User.find({});
    console.log(`Found ${allUsers.length} total users to process`);

    let updatedCount = 0;
    let alreadyCorrectCount = 0;
    let incompleteProfilesCount = 0;

    for (const user of allUsers) {
      try {
        // Calculate what the completion status should be
        const hasAllRequiredFields = !!user.dateOfBirth &&
                                   !!user.countryOfResidence &&
                                   !!user.phoneNumber &&
                                   user.countryOfResidence.trim() !== '' &&
                                   user.phoneNumber.trim() !== '';

        const currentStatus = user.isProfileComplete;
        
        console.log(`\nChecking user: ${user.email} (${user._id})`);
        console.log(`  dateOfBirth: ${user.dateOfBirth || 'missing'}`);
        console.log(`  countryOfResidence: "${user.countryOfResidence || 'missing'}"`);
        console.log(`  phoneNumber: "${user.phoneNumber || 'missing'}"`);
        console.log(`  Should be complete: ${hasAllRequiredFields}`);
        console.log(`  Current status: ${currentStatus}`);

        if (currentStatus === hasAllRequiredFields) {
          console.log(`  ✅ User completion status already correct`);
          alreadyCorrectCount++;
          continue;
        }

        // Update the completion status
        user.isProfileComplete = hasAllRequiredFields;
        await user.save();

        if (hasAllRequiredFields) {
          console.log(`  ✅ Updated user to COMPLETE`);
        } else {
          console.log(`  ⚠️ Updated user to INCOMPLETE (missing required fields)`);
          incompleteProfilesCount++;
        }
        
        updatedCount++;
      } catch (error) {
        console.error(`  ❌ Error processing user ${user.email}:`, error);
      }
    }

    console.log(`\n=== Summary ===`);
    console.log(`Total users processed: ${allUsers.length}`);
    console.log(`Users updated: ${updatedCount}`);
    console.log(`Users already correct: ${alreadyCorrectCount}`);
    console.log(`Users marked as incomplete: ${incompleteProfilesCount}`);

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
