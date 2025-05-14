import cron from 'node-cron';
import mongoose from 'mongoose';
import { logger } from '../utils/logger';
import reminderService from '../services/reminder.service';
import { Event } from '../models/Event';
import { Task } from '../models/Tasks';

interface ProcessingStats {
    totalDue: number;
    processed: number;
    errors: number;
    startTime: Date;
    endTime: Date;
}

let isProcessing = false;
let lastRunTime: Date | null = null;
let consecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 5;
const MAX_PROCESSING_TIME = 45000; // 45 seconds
const BATCH_SIZE = 50;
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds
const MAX_CONNECTION_WAIT = 30000; // 30 seconds

async function waitForConnection(): Promise<boolean> {
    const startTime = Date.now();
    
    // Wait for mongoose to be connected
    while (Date.now() - startTime < MAX_CONNECTION_WAIT) {
        // Check if mongoose is initialized and connected
        if (mongoose.connection && mongoose.connection.readyState === 1) {
            return true;
        }

        // If not connected, try to connect
        if (!mongoose.connection || mongoose.connection.readyState === 0) {
            try {
                await mongoose.connect(process.env.MONGODB_URI!, {
                    serverSelectionTimeoutMS: 5000,
                });
                return true;
            } catch (error) {
                logger.error('Failed to connect to database:', error);
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
            }
        }

        // If connection is in progress, wait
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return false;
}

export function scheduleReminderProcessing(): void {
    // Run every minute
    cron.schedule('* * * * *', async () => {
        if (isProcessing) {
            logger.warn('Previous reminder processing job is still running, skipping this run');
            return;
        }

        // Check if last run was less than 30 seconds ago
        if (lastRunTime && Date.now() - lastRunTime.getTime() < 30000) {
            logger.warn('Last reminder processing job was less than 30 seconds ago, skipping this run');
            return;
        }

        isProcessing = true;
        lastRunTime = new Date();
        const stats: ProcessingStats = {
            totalDue: 0,
            processed: 0,
            errors: 0,
            startTime: new Date(),
            endTime: new Date()
        };

        try {
            // Ensure database connection is ready
            const isConnected = await waitForConnection();
            if (!isConnected) {
                logger.error('Database connection is not ready after maximum wait time');
                consecutiveFailures++;
                return;
            }

            // Process in batches
            let hasMore = true;
            let skip = 0;

            while (hasMore) {
                try {
                    // Get due event reminders
                    const dueEventReminders = await Event.find({
                        'reminders.triggered': false,
                        'reminders.triggerTime': { $lte: new Date() }
                    })
                    .skip(skip)
                    .limit(BATCH_SIZE);

                    // Get due task reminders
                    const dueTaskReminders = await Task.find({
                        'reminders.triggered': false,
                        'reminders.triggerTime': { $lte: new Date() }
                    })
                    .skip(skip)
                    .limit(BATCH_SIZE);

                    // Count total due reminders
                    const totalDueInBatch = dueEventReminders.reduce((sum, event) => 
                        sum + (event.reminders?.filter(r => !r.triggered && r.triggerTime && r.triggerTime <= new Date()).length || 0), 0) +
                        dueTaskReminders.reduce((sum, task) => 
                            sum + (task.reminders?.filter(r => !r.triggered && r.triggerTime && r.triggerTime <= new Date()).length || 0), 0);

                    stats.totalDue += totalDueInBatch;

                    if (totalDueInBatch > 0) {
                        try {
                            await reminderService.processDueReminders();
                            stats.processed += totalDueInBatch;
                            consecutiveFailures = 0;
                        } catch (error) {
                            stats.errors++;
                            consecutiveFailures++;
                            logger.error('Error processing reminders:', error);
                            
                            if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                                logger.error(`Critical: ${consecutiveFailures} consecutive failures in reminder processing`);
                                // Reset connection on critical failure
                                try {
                                    await mongoose.disconnect();
                                    await mongoose.connect(process.env.MONGODB_URI!);
                                } catch (connError) {
                                    logger.error('Failed to reset database connection:', connError);
                                }
                            }
                        }
                    }

                    // Check if we've processed all reminders
                    hasMore = dueEventReminders.length === BATCH_SIZE || dueTaskReminders.length === BATCH_SIZE;
                    skip += BATCH_SIZE;

                    // Check if we've exceeded the maximum processing time
                    if (Date.now() - stats.startTime.getTime() > MAX_PROCESSING_TIME) {
                        logger.warn('Reminder processing exceeded maximum time limit, stopping batch processing');
                        break;
                    }
                } catch (batchError) {
                    logger.error('Error processing batch:', batchError);
                    stats.errors++;
                    // Wait before retrying the batch
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                }
            }

            stats.endTime = new Date();
            const duration = stats.endTime.getTime() - stats.startTime.getTime();

            // Log processing results
            if (stats.totalDue > 0) {
                logger.info(`Reminder processing completed:
                    Total due reminders: ${stats.totalDue}
                    Successfully processed: ${stats.processed}
                    Errors: ${stats.errors}
                    Duration: ${duration}ms
                    Consecutive failures: ${consecutiveFailures}`);
            }
        } catch (error) {
            stats.errors++;
            consecutiveFailures++;
            logger.error('Critical error in reminder processing:', error);
            
            if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                logger.error(`Critical: ${consecutiveFailures} consecutive failures in reminder processing`);
                try {
                    await mongoose.disconnect();
                } catch (disconnectError) {
                    logger.error('Failed to disconnect:', disconnectError);
                }
            }
        } finally {
            isProcessing = false;
        }
    });

    logger.info('Reminder processing job scheduled to run every minute');
}