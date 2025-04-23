import mongoose from 'mongoose';
import { config } from '../config/config';
import { initializeMyPtsSystem } from '../startup/initialize-my-pts-system';

async function init() {
  try {
    // Connect to MongoDB
    await mongoose.connect(config.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Initialize MyPts system
    await initializeMyPtsSystem();
    console.log('MyPts system initialized successfully');

    process.exit(0);
  } catch (error) {
    console.error('Error initializing MyPts system:', error);
    process.exit(1);
  }
}

init();
