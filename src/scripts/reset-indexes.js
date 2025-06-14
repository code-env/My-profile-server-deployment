// const mongoose = require('mongoose');
// require('dotenv').config();

// async function resetIndexes() {
//   try {
//     // Connect to MongoDB
//     await mongoose.connect(process.env.MONGODB_URI, {
//       useNewUrlParser: true,
//       useUnifiedTopology: true,
//     });
//     console.log('Connected to MongoDB');

//     // Get all collections
//     const collections = await mongoose.connection.db.collections();

//     // Drop and recreate indexes for each collection
//     for (const collection of collections) {
//       console.log(`Processing collection: ${collection.collectionName}`);
      
//       // Drop all indexes except _id
//       await collection.dropIndexes();
//       console.log(`Dropped indexes for ${collection.collectionName}`);

//       // Get the model for this collection if it exists
//       const model = mongoose.models[collection.collectionName];
//       if (model) {
//         // Recreate indexes based on schema
//         await model.createIndexes();
//         console.log(`Recreated indexes for ${collection.collectionName}`);
//       }
//     }

//     console.log('Index reset completed successfully');
//   } catch (error) {
//     console.error('Error resetting indexes:', error);
//   } finally {
//     // Close the connection
//     await mongoose.connection.close();
//     console.log('MongoDB connection closed');
//   }
// }

// // Run the script
// resetIndexes(); 