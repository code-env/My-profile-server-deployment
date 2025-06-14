// /**
//  * Script to select all profile template IDs except category: 'individual' and profileType: 'personal'
//  * 
//  * This script:
//  * 1. Connects to the MongoDB database
//  * 2. Finds all profile templates that are NOT (category: 'individual' AND profileType: 'personal')
//  * 3. Returns the IDs of matching templates
//  * 
//  * Run with: npx ts-node src/scripts/select-profile-template-ids.ts
//  */

// import mongoose from 'mongoose';
// import { config } from '../config/config';
// import { ProfileTemplate } from '../models/profiles/profile-template';
// import { logger } from '../utils/logger';

// /**
//  * Selects profile template IDs excluding individual/personal templates
//  */
// async function selectProfileTemplateIds() {
//   try {
//     // Connect to MongoDB
//     logger.info('Connecting to MongoDB...');
//     await mongoose.connect(config.MONGODB_URI);
//     logger.info('Connected to MongoDB');

//     // Find all profile templates except category: 'individual' AND profileType: 'personal'
//     const templates = await ProfileTemplate.find({
//       $nor: [
//         {
//           $and: [
//             { profileCategory: 'individual' },
//             { profileType: 'personal' }
//           ]
//         }
//       ]
//     }, '_id profileCategory profileType name slug');

//     logger.info(`Found ${templates.length} profile templates (excluding individual/personal)`);

//     if (templates.length === 0) {
//       logger.info('No matching profile templates found');
//       return [];
//     }

//     // Log the templates found
//     console.log('\n=== PROFILE TEMPLATES TO BE PROCESSED ===');
//     templates.forEach((template, index) => {
//       console.log(`${index + 1}. ID: ${template._id}`);
//       console.log(`   Category: ${template.profileCategory}`);
//       console.log(`   Type: ${template.profileType}`);
//       console.log(`   Name: ${template.name}`);
//       console.log(`   Slug: ${template.slug}`);
//       console.log('   ---');
//     });

//     // Extract just the IDs
//     const templateIds = templates.map(template => (template._id as mongoose.Types.ObjectId).toString());
    
//     console.log('\n=== TEMPLATE IDS ===');
//     console.log('Template IDs (comma-separated):');
//     console.log(templateIds.join(','));
    
//     console.log('\nTemplate IDs (array format):');
//     console.log(JSON.stringify(templateIds, null, 2));

//     console.log('\nTemplate IDs (MongoDB ObjectId array format):');
//     const objectIdArray = templateIds.map(id => `ObjectId("${id}")`);
//     console.log(`[${objectIdArray.join(', ')}]`);

//     logger.info(`\nSelected ${templateIds.length} profile template IDs`);
    
//     return templateIds;
//   } catch (error) {
//     logger.error('Error selecting profile template IDs:', error);
//     process.exit(1);
//   } finally {
//     await mongoose.connection.close();
//     logger.info('Database connection closed');
//   }
// }

// // Run the selection function
// if (require.main === module) {
//   selectProfileTemplateIds().then(() => {
//     process.exit(0);
//   });
// }

// export { selectProfileTemplateIds }; 