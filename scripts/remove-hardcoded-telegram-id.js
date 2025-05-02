/**
 * Script to remove hardcoded Telegram ID from all users
 * 
 * Run with: node scripts/remove-hardcoded-telegram-id.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
  });

// Define User model schema (simplified)
const userSchema = new mongoose.Schema({
  email: String,
  telegramNotifications: {
    enabled: Boolean,
    username: String,
    telegramId: String,
    preferences: Object
  }
});

const User = mongoose.model('Users', userSchema);

async function removeHardcodedTelegramId() {
  try {
    // Find users with the hardcoded Telegram ID
    const hardcodedId = '8017650902';
    const usersWithHardcodedId = await User.find({ 'telegramNotifications.telegramId': hardcodedId });
    
    console.log(`Found ${usersWithHardcodedId.length} users with hardcoded Telegram ID ${hardcodedId}`);
    
    if (usersWithHardcodedId.length > 0) {
      // Log the users
      usersWithHardcodedId.forEach(user => {
        console.log(`- User ${user.email} has hardcoded Telegram ID`);
      });
      
      // Remove the hardcoded ID
      const result = await User.updateMany(
        { 'telegramNotifications.telegramId': hardcodedId },
        { $unset: { 'telegramNotifications.telegramId': '' } }
      );
      
      console.log(`Updated ${result.modifiedCount} users to remove hardcoded Telegram ID`);
    } else {
      console.log('No users found with hardcoded Telegram ID');
    }
    
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error removing hardcoded Telegram ID:', error);
    process.exit(1);
  }
}

// Run the function
removeHardcodedTelegramId();
