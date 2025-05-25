/**
 * Script to diagnose a specific user's profile completion status
 *
 * Run with: ts-node src/scripts/diagnose-user-profile.ts <userId>
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

async function diagnoseUser(userId: string) {
  try {
    console.log(`Diagnosing user: ${userId}`);

    const user = await User.findById(userId);

    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log(`\n=== User Details ===`);
    console.log(`Email: ${user.email}`);
    console.log(`Full Name: ${user.fullName}`);
    console.log(`Signup Type: ${user.signupType}`);
    console.log(`Account Type: ${user.accountType}`);

    console.log(`\n=== Profile Completion Fields ===`);
    console.log(`Date of Birth: ${user.dateOfBirth ? '✅ ' + user.dateOfBirth : '❌ Missing'}`);
    console.log(`Country of Residence: ${user.countryOfResidence ? '✅ ' + user.countryOfResidence : '❌ Missing'}`);
    console.log(`Phone Number: ${user.phoneNumber ? '✅ ' + user.phoneNumber : '❌ Missing'}`);
    console.log(`Is Profile Complete: ${user.isProfileComplete ? '✅ True' : '❌ False'}`);

    // Check field types and values more deeply
    console.log(`\n=== Detailed Field Analysis ===`);
    console.log(`dateOfBirth type: ${typeof user.dateOfBirth}, value: ${JSON.stringify(user.dateOfBirth)}`);
    console.log(`countryOfResidence type: ${typeof user.countryOfResidence}, value: ${JSON.stringify(user.countryOfResidence)}`);
    console.log(`phoneNumber type: ${typeof user.phoneNumber}, value: ${JSON.stringify(user.phoneNumber)}`);
    console.log(`isProfileComplete type: ${typeof user.isProfileComplete}, value: ${JSON.stringify(user.isProfileComplete)}`);

    // Check if user meets completion criteria
    const hasDateOfBirth = user.dateOfBirth && user.dateOfBirth !== null;
    const hasCountry = user.countryOfResidence && user.countryOfResidence !== null && user.countryOfResidence !== '';
    const hasPhone = user.phoneNumber && user.phoneNumber !== null && user.phoneNumber !== '';

    console.log(`\n=== Profile Completion Analysis ===`);
    console.log(`Has Date of Birth: ${hasDateOfBirth ? '✅' : '❌'}`);
    console.log(`Has Country: ${hasCountry ? '✅' : '❌'}`);
    console.log(`Has Phone: ${hasPhone ? '✅' : '❌'}`);
    console.log(`Should be complete: ${hasDateOfBirth && hasCountry && hasPhone ? '✅ YES' : '❌ NO'}`);
    console.log(`Currently marked complete: ${user.isProfileComplete ? '✅ YES' : '❌ NO'}`);

    // If it should be complete but isn't, offer to fix it
    if (hasDateOfBirth && hasCountry && hasPhone && !user.isProfileComplete) {
      console.log(`\n⚠️  ISSUE DETECTED: User has all required fields but isProfileComplete is false`);
      console.log(`Would you like to fix this? (This script will automatically fix it)`);

      // Fix the user
      user.isProfileComplete = true;
      await user.save();

      console.log(`✅ Fixed! Set isProfileComplete to true for user ${user.email}`);
    } else if (!hasDateOfBirth || !hasCountry || !hasPhone) {
      console.log(`\n✅ Profile completion status is correct - user is missing required fields`);
    } else {
      console.log(`\n✅ Profile completion status is correct - user is already marked as complete`);
    }

  } catch (error) {
    console.error('Error diagnosing user:', error);
  }
}

async function main() {
  await connectToDatabase();

  const userId = process.argv[2];
  if (!userId) {
    console.error('Please provide a user ID as an argument');
    console.error('Usage: ts-node src/scripts/diagnose-user-profile.ts <userId>');
    process.exit(1);
  }

  await diagnoseUser(userId);

  // Disconnect from MongoDB
  await mongoose.disconnect();
  console.log('\nDisconnected from MongoDB');
}

main().catch(console.error);
