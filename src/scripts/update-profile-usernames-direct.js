/**
 * Script to update profile usernames to match user fullNames
 * 
 * This script uses MongoDB directly to update profile usernames
 * without requiring the model imports.
 */

const mongoose = require('mongoose');

// Connect to MongoDB
async function connectToDatabase() {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/myprofile';
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB');
    return mongoose.connection;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

// Update profile usernames to match user fullNames
async function updateProfileUsernames(db) {
  try {
    console.log('Starting profile username update process...');
    
    // Get collections
    const usersCollection = db.collection('users');
    const profilesCollection = db.collection('profiles');
    
    // Get all profiles
    const profiles = await profilesCollection.find({}).toArray();
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
        const user = await usersCollection.findOne({ _id: new mongoose.Types.ObjectId(creatorId) });
        
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
        
        const updateResult = await profilesCollection.updateOne(
          { _id: profile._id },
          { 
            $set: { 
              'profileInformation.username': fullName,
              'profileInformation.updatedAt': new Date()
            } 
          }
        );
        
        if (updateResult.modifiedCount > 0) {
          console.log(`Updated profile ${profile._id} username from "${oldUsername}" to "${fullName}"`);
          updatedCount++;
        } else {
          console.log(`Failed to update profile ${profile._id}`);
          errorCount++;
        }
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
  let connection;
  try {
    connection = await connectToDatabase();
    const result = await updateProfileUsernames(connection.db);
    console.log('Script completed successfully:', result);
  } catch (error) {
    console.error('Script failed:', error);
  } finally {
    if (connection) {
      await mongoose.disconnect();
      console.log('Disconnected from MongoDB');
    }
    process.exit(0);
  }
}

// Run the script
main();
