require('dotenv').config();
const mongoose = require('mongoose');

async function testConnection() {
  try {
    console.log('Starting connection test...');
    const mongoUri = process.env.MONGODB_URI;
    console.log('MongoDB URI exists:', !!mongoUri);

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB successfully');

    // Test basic query
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log('Available collections:', collections.map(c => c.name));

    await mongoose.disconnect();
    console.log('✅ Disconnected successfully');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testConnection();
