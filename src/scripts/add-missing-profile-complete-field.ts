/**
 * Script to add the missing isProfileComplete field to users who don't have it
 * 
 * Run with: npm run add-missing-profile-complete
 */

import * as dotenv from 'dotenv';
import mongoose from 'mongoose';
import { User } from '../models/User';

// Load environment variables
dotenv.config();

async function connectToDatabase() {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/myprofile';
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

async function addMissingProfileCompleteField() {
  try {
    console.log('Starting to add missing isProfileComplete field...');

    // Find all users who don't have the isProfileComplete field
    const usersWithoutField = await User.find({ 
      isProfileComplete: { $exists: false } 
    });

    console.log(`Found ${usersWithoutField.length} users without isProfileComplete field`);

    let addedCount = 0;
    let errorCount = 0;

    // Process each user
    for (const user of usersWithoutField) {
      try {
        // Calculate profile completion status based on your criteria
        const hasAllRequiredFields = !!user.dateOfBirth &&
                                   !!user.countryOfResidence &&
                                   !!user.phoneNumber &&
                                   user.countryOfResidence.trim() !== '' &&
                                   (user.phoneNumber ? user.phoneNumber.trim() !== '' : false);

        // Add the isProfileComplete field
        await User.updateOne(
          { _id: user._id },
          { $set: { isProfileComplete: hasAllRequiredFields } }
        );

        console.log(`✅ Added isProfileComplete: ${hasAllRequiredFields} to user ${user.email} (${user._id})`);
        addedCount++;
      } catch (userError) {
        console.error(`❌ Error updating user ${user._id}:`, userError);
        errorCount++;
      }
    }

    console.log('\n=== Summary ===');
    console.log(`Total users without field: ${usersWithoutField.length}`);
    console.log(`Successfully added field: ${addedCount}`);
    console.log(`Errors encountered: ${errorCount}`);

    return { usersWithoutField: usersWithoutField.length, addedCount, errorCount };
  } catch (error) {
    console.error('Error in addMissingProfileCompleteField:', error);
    throw error;
  }
}

async function main() {
  try {
    await connectToDatabase();
    const result = await addMissingProfileCompleteField();
    console.log('Script completed successfully:', result);
    process.exit(0);
  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  } finally {
    // Close MongoDB connection
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

main();
