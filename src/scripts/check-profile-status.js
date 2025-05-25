/**
 * Quick script to check profile completion status for Google auth users
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Import the User model - we'll need to require it properly
const { User } = require('../models/User');

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

async function checkProfileStatus() {
  try {
    console.log('Checking profile completion status...\n');

    // Find Google auth users with profile data but isProfileComplete false
    const usersWithIssue = await User.find({
      signupType: 'google',
      isProfileComplete: false,
      dateOfBirth: { $exists: true, $ne: null },
      countryOfResidence: { $exists: true, $ne: null },
      phoneNumber: { $exists: true, $ne: null }
    }).limit(5);

    console.log(`Found ${usersWithIssue.length} Google auth users with profile completion issue:`);

    for (const user of usersWithIssue) {
      console.log(`\n--- User: ${user.email} ---`);
      console.log(`Signup Type: ${user.signupType}`);
      console.log(`Date of Birth: ${user.dateOfBirth ? '✅ ' + user.dateOfBirth.toISOString().split('T')[0] : '❌ Missing'}`);
      console.log(`Country: ${user.countryOfResidence ? '✅ ' + user.countryOfResidence : '❌ Missing'}`);
      console.log(`Phone: ${user.phoneNumber ? '✅ ' + user.phoneNumber : '❌ Missing'}`);
      console.log(`Is Profile Complete: ${user.isProfileComplete ? '✅ True' : '❌ False'}`);

      // Check if all required fields are actually present and valid
      const hasAllRequiredFields = !!user.dateOfBirth &&
                                   !!user.countryOfResidence &&
                                   !!user.phoneNumber &&
                                   user.countryOfResidence.trim() !== '' &&
                                   user.phoneNumber.trim() !== '';

      console.log(`Should be complete: ${hasAllRequiredFields ? '✅ Yes' : '❌ No'}`);
    }

    // Also check total counts
    const totalUsers = await User.countDocuments({ signupType: 'google' });
    const completeUsers = await User.countDocuments({ signupType: 'google', isProfileComplete: true });
    const incompleteUsers = await User.countDocuments({ signupType: 'google', isProfileComplete: false });

    console.log(`\n=== Summary ===`);
    console.log(`Total Google auth users: ${totalUsers}`);
    console.log(`Profile complete: ${completeUsers}`);
    console.log(`Profile incomplete: ${incompleteUsers}`);

  } catch (error) {
    console.error('Error checking profile status:', error);
  }
}

async function main() {
  await connectToDatabase();
  await checkProfileStatus();

  await mongoose.disconnect();
  console.log('\nDisconnected from MongoDB');
}

main().catch(console.error);
