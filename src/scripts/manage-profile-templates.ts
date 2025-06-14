// /**
//  * Combined script to manage profile templates
//  * 
//  * This script can:
//  * 1. Select profile template IDs (excluding individual/personal)
//  * 2. Bulk delete profile templates by IDs
//  * 3. Run both operations in sequence
//  * 
//  * Run with: npx ts-node src/scripts/manage-profile-templates.ts
//  */

// import { selectProfileTemplateIds } from './select-profile-template-ids';
// import { bulkDeleteProfileTemplates } from './bulk-delete-profile-templates';
// import { logger } from '../utils/logger';
// import readline from 'readline';

// /**
//  * Creates a readline interface for user input
//  */
// function createReadlineInterface() {
//   return readline.createInterface({
//     input: process.stdin,
//     output: process.stdout
//   });
// }

// /**
//  * Prompts user for menu choice
//  */
// function askForChoice(question: string): Promise<string> {
//   return new Promise((resolve) => {
//     const rl = createReadlineInterface();
//     rl.question(question, (answer) => {
//       rl.close();
//       resolve(answer.trim());
//     });
//   });
// }

// /**
//  * Prompts user for confirmation
//  */
// function askForConfirmation(question: string): Promise<boolean> {
//   return new Promise((resolve) => {
//     const rl = createReadlineInterface();
//     rl.question(question, (answer) => {
//       rl.close();
//       resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
//     });
//   });
// }

// /**
//  * Main menu for profile template management
//  */
// async function showMainMenu() {
//   console.log('\n🔧 Profile Template Management Tool');
//   console.log('===================================');
//   console.log('1. Select template IDs (excluding individual/personal)');
//   console.log('2. Bulk delete templates by IDs');
//   console.log('3. Select and delete in sequence');
//   console.log('4. Exit');
//   console.log('');

//   const choice = await askForChoice('Choose an option (1-4): ');

//   switch (choice) {
//     case '1':
//       await runSelectTemplateIds();
//       break;
//     case '2':
//       await runBulkDelete();
//       break;
//     case '3':
//       await runSelectAndDelete();
//       break;
//     case '4':
//       console.log('👋 Goodbye!');
//       process.exit(0);
//       break;
//     default:
//       console.log('❌ Invalid choice. Please select 1-4.');
//       await showMainMenu();
//   }
// }

// /**
//  * Run template ID selection
//  */
// async function runSelectTemplateIds() {
//   try {
//     console.log('\n🔍 Selecting Profile Template IDs...');
//     const templateIds = await selectProfileTemplateIds();
    
//     if (templateIds.length > 0) {
//       console.log('\n✅ Template selection completed!');
//       console.log('💡 You can copy the IDs above to use in the bulk delete script.');
//     }
//   } catch (error) {
//     logger.error('Error selecting template IDs:', error);
//     console.log('❌ Error selecting template IDs. Check logs for details.');
//   }

//   const continueChoice = await askForConfirmation('\nReturn to main menu? (yes/no): ');
//   if (continueChoice) {
//     await showMainMenu();
//   } else {
//     process.exit(0);
//   }
// }

// /**
//  * Run bulk deletion
//  */
// async function runBulkDelete() {
//   try {
//     console.log('\n🗑️  Bulk Deleting Profile Templates...');
//     console.log('⚠️  Make sure you have the template IDs ready in the bulk-delete-profile-templates.ts file');
    
//     await bulkDeleteProfileTemplates();
//     console.log('\n✅ Bulk deletion completed!');
//   } catch (error) {
//     logger.error('Error during bulk deletion:', error);
//     console.log('❌ Error during bulk deletion. Check logs for details.');
//   }

//   const continueChoice = await askForConfirmation('\nReturn to main menu? (yes/no): ');
//   if (continueChoice) {
//     await showMainMenu();
//   } else {
//     process.exit(0);
//   }
// }

// /**
//  * Run select and delete in sequence
//  */
// async function runSelectAndDelete() {
//   try {
//     console.log('\n🔄 Running Select and Delete Sequence...');
//     console.log('=====================================');
    
//     // Step 1: Select template IDs
//     console.log('\n📋 Step 1: Selecting template IDs...');
//     const templateIds = await selectProfileTemplateIds();
    
//     if (templateIds.length === 0) {
//       console.log('❌ No templates found to delete.');
//       const continueChoice = await askForConfirmation('\nReturn to main menu? (yes/no): ');
//       if (continueChoice) {
//         await showMainMenu();
//       } else {
//         process.exit(0);
//       }
//       return;
//     }

//     // Step 2: Confirm before deletion
//     console.log('\n⚠️  WARNING: You are about to delete the templates listed above!');
//     const proceedWithDeletion = await askForConfirmation(
//       `Proceed with deleting ${templateIds.length} template(s)? (yes/no): `
//     );

//     if (!proceedWithDeletion) {
//       console.log('❌ Deletion cancelled.');
//       const continueChoice = await askForConfirmation('\nReturn to main menu? (yes/no): ');
//       if (continueChoice) {
//         await showMainMenu();
//       } else {
//         process.exit(0);
//       }
//       return;
//     }

//     // Step 3: Perform bulk deletion
//     console.log('\n🗑️  Step 2: Deleting templates...');
//     await bulkDeleteProfileTemplates(templateIds);
    
//     console.log('\n✅ Select and delete sequence completed!');
    
//   } catch (error) {
//     logger.error('Error during select and delete sequence:', error);
//     console.log('❌ Error during sequence. Check logs for details.');
//   }

//   const continueChoice = await askForConfirmation('\nReturn to main menu? (yes/no): ');
//   if (continueChoice) {
//     await showMainMenu();
//   } else {
//     process.exit(0);
//   }
// }

// // Run the main menu if this script is executed directly
// if (require.main === module) {
//   showMainMenu().catch((error) => {
//     logger.error('Unexpected error in main menu:', error);
//     process.exit(1);
//   });
// } 