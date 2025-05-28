import mongoose from 'mongoose';
import { List } from '../models/List';
import { mapExternalToInternal } from '../utils/visibilityMapper';
import { logger } from '../utils/logger';

/**
 * Migration to fix invalid visibility values in existing lists
 * Converts 'Private' to 'ConnectionsOnly' and other invalid values
 */
export async function fixListVisibility() {
    try {
        logger.info('Starting list visibility migration...');
        
        // Find all lists with invalid visibility values
        const listsToFix = await List.find({
            visibility: { $nin: ['Public', 'ConnectionsOnly', 'OnlyMe', 'Custom'] }
        });
        
        logger.info(`Found ${listsToFix.length} lists with invalid visibility values`);
        
        let fixedCount = 0;
        
        for (const list of listsToFix) {
            const oldVisibility = list.visibility as string;
            
            // Map the visibility value
            if (oldVisibility === 'Private') {
                list.visibility = mapExternalToInternal('Private' as any);
            } else if (oldVisibility === 'Hidden') {
                list.visibility = mapExternalToInternal('Hidden' as any);
            } else if (oldVisibility === 'Everyone (Public)' || oldVisibility === 'public') {
                list.visibility = 'Public';
            } else {
                // Default to ConnectionsOnly for any other invalid values
                list.visibility = 'ConnectionsOnly';
            }
            
            try {
                await list.save();
                logger.info(`Fixed list ${list._id}: '${oldVisibility}' -> '${list.visibility}'`);
                fixedCount++;
            } catch (error) {
                logger.error(`Failed to fix list ${list._id}:`, error);
            }
        }
        
        logger.info(`List visibility migration completed. Fixed ${fixedCount} out of ${listsToFix.length} lists.`);
        
        return {
            total: listsToFix.length,
            fixed: fixedCount,
            failed: listsToFix.length - fixedCount
        };
        
    } catch (error) {
        logger.error('Error during list visibility migration:', error);
        throw error;
    }
}

/**
 * Run the migration if this file is executed directly
 */
if (require.main === module) {
    mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/mypts')
        .then(async () => {
            logger.info('Connected to MongoDB for migration');
            const result = await fixListVisibility();
            logger.info('Migration result:', result);
            process.exit(0);
        })
        .catch((error) => {
            logger.error('Migration failed:', error);
            process.exit(1);
        });
} 