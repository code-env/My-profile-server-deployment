/**
 * Script to update profile usernames to match user fullNames
 *
 * This script finds all profiles and updates their username field to match
 * the fullName of the user who created the profile.
 */

const mongoose = require('mongoose');
const { User } = require('../models/User.ts');
const { ProfileModel } = require('../models/profile.model.ts');
const { logger } = require('../utils/logger');

// Connect to MongoDB
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

// Update profile usernames to match user fullNames
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

// Main function
async function main() {
  try {
    await connectToDatabase();
    const result = await updateProfileUsernames();
    console.log('Script completed successfully:', result);
    process.exit(0);
  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  }
}

// Run the script
main();
