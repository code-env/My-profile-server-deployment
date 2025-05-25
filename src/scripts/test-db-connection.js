/**
 * Simple test script to check database connection
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  try {
    console.log('Attempting to connect to MongoDB...');
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/myprofile';
    console.log('Using URI:', mongoURI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')); // Hide credentials
    
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB successfully');
    
    // Test simple query
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log('Available collections:', collections.map(c => c.name));
    
    await mongoose.disconnect();
    console.log('✅ Disconnected successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Connection failed:', error);
    process.exit(1);
  }
}

main();
