/**
 * Script to bulk delete profile templates by their IDs
 * 
 * This script:
 * 1. Connects to the MongoDB database
 * 2. Takes an array of profile template IDs
 * 3. Deletes all templates with those IDs in bulk
 * 4. Shows confirmation before deletion
 * 
 * Run with: npx ts-node src/scripts/bulk-delete-profile-templates.ts
 */

import mongoose from 'mongoose';
import { config } from '../config/config';
import { ProfileTemplate } from '../models/profiles/profile-template';
import { logger } from '../utils/logger';
import readline from 'readline';

// Configure the template IDs to delete here
// You can get these IDs from the select-profile-template-ids.ts script
const TEMPLATE_IDS_TO_DELETE: string[] = [
  // Add the template IDs you want to delete here
  // Example:
  // '675a1234567890abcdef1234',
  // '675a5678901234abcdef5678',
];

/**
 * Creates a readline interface for user input
 */
function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

/**
 * Prompts user for confirmation
 */
function askForConfirmation(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = createReadlineInterface();
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

/**
 * Bulk deletes profile templates by their IDs
 */
async function bulkDeleteProfileTemplates(templateIds?: string[]) {
  try {
    // Use provided IDs or default to the configured ones
    const idsToDelete = templateIds || TEMPLATE_IDS_TO_DELETE;

    if (idsToDelete.length === 0) {
      logger.warn('No template IDs provided for deletion');
      console.log('\n⚠️  No template IDs specified for deletion.');
      console.log('Please either:');
      console.log('1. Add IDs to the TEMPLATE_IDS_TO_DELETE array in this script');
      console.log('2. Call this function with an array of IDs');
      console.log('3. Use the select-profile-template-ids.ts script to get IDs first');
      return;
    }

    // Connect to MongoDB
    logger.info('Connecting to MongoDB...');
    await mongoose.connect(config.MONGODB_URI);
    logger.info('Connected to MongoDB');

    // Convert string IDs to ObjectIds
    const objectIds = idsToDelete.map(id => new mongoose.Types.ObjectId(id));

    // First, find the templates to see what will be deleted
    const templatesToDelete = await ProfileTemplate.find({
      _id: { $in: objectIds }
    }, '_id profileCategory profileType name slug');

    console.log('\n=== TEMPLATES TO BE DELETED ===');
    if (templatesToDelete.length === 0) {
      logger.warn('No templates found with the provided IDs');
      console.log('❌ No templates found with the provided IDs.');
      console.log('Please check the IDs and try again.');
      return;
    }

    console.log(`Found ${templatesToDelete.length} templates to delete:`);
    templatesToDelete.forEach((template, index) => {
      console.log(`${index + 1}. ID: ${template._id}`);
      console.log(`   Category: ${template.profileCategory}`);
      console.log(`   Type: ${template.profileType}`);
      console.log(`   Name: ${template.name}`);
      console.log(`   Slug: ${template.slug}`);
      console.log('   ---');
    });

    // Check if there are any profiles using these templates
    const { ProfileModel } = await import('../models/profile.model');
    const profilesUsingTemplates = await ProfileModel.find({
      templatedId: { $in: objectIds }
    }, '_id profileInformation.username templatedId').limit(10);

    if (profilesUsingTemplates.length > 0) {
      console.log('\n⚠️  WARNING: PROFILES ARE USING THESE TEMPLATES');
      console.log(`Found ${profilesUsingTemplates.length} profiles using these templates:`);
      profilesUsingTemplates.forEach((profile, index) => {
        console.log(`${index + 1}. Profile ID: ${profile._id}`);
        console.log(`   Username: ${profile.profileInformation?.username || 'N/A'}`);
        console.log(`   Template ID: ${profile.templatedId}`);
      });
      
      if (profilesUsingTemplates.length === 10) {
        const totalCount = await ProfileModel.countDocuments({
          templatedId: { $in: objectIds }
        });
        console.log(`   ... and ${totalCount - 10} more profiles`);
      }
      
      console.log('\n🚨 DANGER: Deleting these templates may cause issues with existing profiles!');
    }

    // Ask for confirmation
    console.log('\n=== CONFIRMATION REQUIRED ===');
    const confirmed = await askForConfirmation(
      `Are you sure you want to delete ${templatesToDelete.length} profile template(s)? This action cannot be undone. (yes/no): `
    );

    if (!confirmed) {
      logger.info('Deletion cancelled by user');
      console.log('❌ Deletion cancelled.');
      return;
    }

    // Perform the bulk deletion
    logger.info(`Deleting ${templatesToDelete.length} profile templates...`);
    const deleteResult = await ProfileTemplate.deleteMany({
      _id: { $in: objectIds }
    });

    console.log('\n=== DELETION COMPLETED ===');
    logger.info(`Successfully deleted ${deleteResult.deletedCount} profile templates`);
    console.log(`✅ Deleted ${deleteResult.deletedCount} profile template(s)`);

    if (deleteResult.deletedCount !== templatesToDelete.length) {
      logger.warn(`Expected to delete ${templatesToDelete.length} templates, but only deleted ${deleteResult.deletedCount}`);
      console.log(`⚠️  Warning: Expected to delete ${templatesToDelete.length} but only deleted ${deleteResult.deletedCount}`);
    }

  } catch (error) {
    logger.error('Error during bulk deletion:', error);
    console.log('❌ Error during deletion:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    logger.info('Database connection closed');
  }
}

// Export function for use in other scripts
export { bulkDeleteProfileTemplates };

// Run the deletion function if this script is executed directly
if (require.main === module) {
  bulkDeleteProfileTemplates().then(() => {
    process.exit(0);
  });
} 