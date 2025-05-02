/**
 * Script to check and fix missing profiles for users
 * 
 * Run with: node src/scripts/fix-profile.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { ProfileModel } = require('../models/profile.model');
const { User } = require('../models/User');

async function connectToDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

async function generateUniqueConnectLink() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let connectLink;
  let isUnique = false;

  while (!isUnique) {
    // Generate a random string of 8 characters
    connectLink = '';
    for (let i = 0; i < 8; i++) {
      connectLink += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    // Check if it's unique
    const existingProfile = await ProfileModel.findOne({ connectLink });
    if (!existingProfile) {
      isUnique = true;
    }
  }

  return connectLink;
}

async function checkAndFixProfile(userId) {
  try {
    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      console.error(`User not found: ${userId}`);
      return;
    }

    console.log(`Checking profile for user: ${user.email} (${userId})`);

    // Check if the user has a profileId
    if (user.profileId) {
      console.log(`User has profileId: ${user.profileId}`);
      
      // Check if the profile exists
      const profile = await ProfileModel.findById(user.profileId);
      if (profile) {
        console.log(`Profile exists: ${profile._id}`);
        return;
      } else {
        console.log(`Profile with ID ${user.profileId} not found in database`);
      }
    }

    // Check profiles array
    if (user.profiles && user.profiles.length > 0) {
      console.log(`User has ${user.profiles.length} profiles in profiles array`);
      
      // Check if any of these profiles exist
      for (const profileId of user.profiles) {
        const profile = await ProfileModel.findById(profileId);
        if (profile) {
          console.log(`Found existing profile: ${profile._id}`);
          
          // Update user's profileId if it's not set
          if (!user.profileId) {
            user.profileId = profile._id.toString();
            await user.save();
            console.log(`Updated user's profileId to ${profile._id}`);
          }
          
          return;
        }
      }
      
      console.log('None of the profiles in the profiles array exist in the database');
    }

    // If we get here, we need to create a new profile
    console.log('Creating new profile for user');
    
    // Generate a unique connect link
    const connectLink = await generateUniqueConnectLink();

    // Create a default personal profile
    const newProfile = new ProfileModel({
      name: `${user.fullName}'s Profile`,
      description: `Personal profile for ${user.fullName}`,
      profileType: 'personal',
      profileCategory: 'individual',
      owner: userId,
      managers: [userId],
      connectLink,
      claimed: true,
      claimedBy: userId,
      claimedAt: new Date(),
      settings: {
        visibility: 'public',
        allowComments: true,
        allowMessages: true,
        autoAcceptConnections: false,
        emailNotifications: {
          connections: true,
          messages: true,
          comments: true,
          mentions: true,
          updates: true
        }
      }
    });

    await newProfile.save();
    console.log(`Created new profile: ${newProfile._id}`);

    // Update user with profile ID
    user.profileId = newProfile._id.toString();
    user.profiles = [newProfile._id];
    await user.save();
    console.log(`Updated user with new profile ID: ${newProfile._id}`);

    return newProfile;
  } catch (error) {
    console.error('Error checking and fixing profile:', error);
  }
}

async function main() {
  await connectToDatabase();

  // Check specific user
  const userId = '68123f790bb2155736a04580'; // Replace with the user ID you want to check
  await checkAndFixProfile(userId);

  // Disconnect from MongoDB
  await mongoose.disconnect();
  console.log('Disconnected from MongoDB');
}

main().catch(console.error);
