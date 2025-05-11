/**
 * Profile Username Update Script
 *
 * This script updates all profile usernames to match the fullName of the user who created the profile.
 * It ensures that the profile username field contains the user's fullName instead of their username.
 *
 * Key features:
 * - Finds all profiles in the database
 * - Looks up the creator user for each profile
 * - Updates the profile's username to match the user's fullName
 * - Logs statistics for monitoring
 */

import { User } from '../models/User';
import { ProfileModel } from '../models/profile.model';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';

/**
 * Connect to MongoDB
 */
async function connectToDatabase() {
  try {
    // Load environment variables
    require('dotenv').config();

    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/myprofile';
    console.log(`Connecting to MongoDB at ${mongoURI.split('@').pop()}`);

    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

/**
 * Update profile usernames to match user fullNames
 */
async function updateProfileUsernames() {
  try {
    console.log('Starting profile username update process...');

    // Get all profiles
    const profiles = await ProfileModel.find({});
    console.log(`Found ${profiles.length} profiles to process`);

    let updatedCount = 0;
    let errorCount = 0;

    // Process each profile
    for (const profile of profiles) {
      try {
        // Get the creator user ID
        const creatorId = profile.profileInformation?.creator;

        if (!creatorId) {
          console.log(`Profile ${profile._id} has no creator ID, skipping`);
          continue;
        }

        // Find the user
        const user = await User.findById(creatorId);

        if (!user) {
          console.log(`Creator user not found for profile ${profile._id}, skipping`);
          continue;
        }

        // Get the user's fullName
        const fullName = user.fullName;

        if (!fullName) {
          console.log(`User ${user._id} has no fullName, skipping profile ${profile._id}`);
          continue;
        }

        // Check if the profile username already matches the user's fullName
        if (profile.profileInformation?.username === fullName) {
          console.log(`Profile ${profile._id} username already matches user's fullName: ${fullName}`);
          continue;
        }

        // Update the profile username
        const oldUsername = profile.profileInformation?.username || 'none';
        profile.profileInformation.username = fullName;
        profile.profileInformation.updatedAt = new Date();

        // Save the updated profile
        await profile.save();

        console.log(`Updated profile ${profile._id} username from "${oldUsername}" to "${fullName}"`);
        updatedCount++;
      } catch (profileError) {
        console.error(`Error updating profile ${profile._id}:`, profileError);
        errorCount++;
      }
    }

    console.log(`Profile username update process completed.`);
    console.log(`Updated ${updatedCount} profiles.`);
    console.log(`Encountered errors with ${errorCount} profiles.`);

    return { updatedCount, errorCount };
  } catch (error) {
    console.error('Error in updateProfileUsernames:', error);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    await connectToDatabase();
    const result = await updateProfileUsernames();
    console.log('Script completed successfully:', result);

    // Close the database connection
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');

    process.exit(0);
  } catch (error) {
    console.error('Script failed:', error);

    // Try to close the database connection
    try {
      await mongoose.disconnect();
      console.log('Disconnected from MongoDB');
    } catch (disconnectError) {
      console.error('Error disconnecting from MongoDB:', disconnectError);
    }

    process.exit(1);
  }
}

// Run the script
main();
