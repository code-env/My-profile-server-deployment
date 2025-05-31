import { Event, IEvent } from '../models/Event';
import { Task, ITask } from '../models/Tasks';
import { List, IList } from '../models/List';
import { NotificationService } from './notification.service';
import { SettingsService } from './settings.service';
import { logger } from '../utils/logger';
import mongoose, { Model } from 'mongoose';
import { mapExternalToInternal } from '../utils/visibilityMapper';
import { Reminder, ReminderType, ReminderUnit } from '../models/plans-shared';
import EmailService from './email.service';
import { TimezoneUtils } from '../utils/timezoneUtils';

class ReminderService {
    private notificationService: NotificationService;
    private emailService: EmailService;
    private settingsService: SettingsService;
    private readonly MAX_RETRIES = 3;
    private readonly RETRY_DELAY = 5000; // 5 seconds

    constructor() {
        this.notificationService = new NotificationService();
        this.emailService = new EmailService();
        this.settingsService = new SettingsService();
    }

    /**
     * Add a reminder to an event, task, or list item with timezone awareness
     */
    async addReminder(
        itemId: string,
        itemType: 'event' | 'task' | 'list',
        reminderType: ReminderType,
        customValue?: number,
        customUnit?: 'minutes' | 'hours' | 'days' | 'weeks',
        userId?: string
    ): Promise<Reminder> {
        try {
            // Get the item based on type
            let item: any;
            let itemTime: Date;
            let createdBy: string;

            if (itemType === 'event') {
                item = await Event.findById(itemId);
                if (!item) throw new Error('Event not found');
                itemTime = item.startTime;
                createdBy = item.createdBy;
            } else if (itemType === 'task') {
                item = await Task.findById(itemId);
                if (!item) throw new Error('Task not found');
                itemTime = item.startTime || item.createdAt;
                createdBy = item.createdBy;
            } else {
                item = await List.findById(itemId);
                if (!item) throw new Error('List not found');
                itemTime = item.createdAt;
                createdBy = item.createdBy;
            }

            // Get user timezone
            const userTimezone = await TimezoneUtils.getUserTimezone(createdBy.toString());

            // Calculate reminder time with timezone awareness
            const reminderTime = await this.calculateReminderTime(
                itemTime,
                reminderType,
                customValue,
                customUnit,
                userTimezone
            );

            // Create reminder object
            const reminder: Reminder = {
                type: reminderType,
                amount: customValue,
                unit: customUnit as ReminderUnit,
                triggered: false,
                triggerTime: reminderTime
            };

            // Add reminder to the item
            if (!item.reminders) {
                item.reminders = [];
            }
            item.reminders.push(reminder);
            await item.save();

            logger.info(`Reminder created for ${itemType} ${itemId} at ${reminderTime} (${userTimezone})`);

            return reminder;
        } catch (error) {
            logger.error(`Error adding reminder: ${error}`);
            throw error;
        }
    }

    /**
     * Update reminder status and calculate next trigger time for repeating events with timezone awareness
     */
    async updateReminderStatus(
        itemId: string,
        reminderIndex: number,
        status: 'pending' | 'sent' | 'failed',
        itemType: 'event' | 'task' = 'event'
    ): Promise<IEvent | ITask> {
        const Model = (itemType === 'event' ? Event : Task) as Model<IEvent | ITask>;
        const item = await Model.findById(itemId);
        if (!item) {
            throw new Error(`${itemType} not found`);
        }

        if (!item.reminders || reminderIndex >= item.reminders.length) {
            throw new Error('Reminder not found');
        }

        const reminder = item.reminders[reminderIndex];
        reminder.triggered = status === 'sent';

        if (status === 'sent') {
            // For repeating events, calculate next trigger time only if not at end condition
            if (item.repeat?.isRepeating) {
                const nextEventTime = this.calculateNextEventTime(item);
                if (nextEventTime) {
                    // Update the event's next run time
                    item.repeat.nextRun = nextEventTime;
                    
                    // Get user's timezone for calculating next reminder time
                    const userSettings = await this.settingsService.getSettings(item.createdBy.toString());
                    const userTimezone = userSettings?.general?.time?.timeZone || 'UTC';
                    
                    // Calculate and set next reminder time
                    const reminderType = reminder.type || ReminderType.Hours1; // Default fallback
                    const customValue = reminder.amount;
                    const customUnit = reminder.unit === ReminderUnit.Minutes ? 'minutes' :
                                     reminder.unit === ReminderUnit.Hours ? 'hours' :
                                     reminder.unit === ReminderUnit.Days ? 'days' :
                                     reminder.unit === ReminderUnit.Weeks ? 'weeks' : 'hours';
                    
                    reminder.triggerTime = await this.calculateReminderTime(
                        nextEventTime,
                        reminderType,
                        customValue,
                        customUnit,
                        userTimezone
                    );
                    reminder.triggered = false; // Reset for next occurrence
                } else {
                    // If no next event time (end condition reached), just mark as triggered
                    reminder.triggerTime = new Date();
                }
            } else {
                // For non-repeating events, just mark as triggered
                reminder.triggerTime = new Date();
            }
        }

        await item.save();
        return item;
    }

    /**
     * Calculate next event time based on repeat settings
     */
    private calculateNextEventTime(item: IEvent | ITask): Date | null {
        if (!item.repeat?.isRepeating || !item.repeat?.frequency) {
            return null;
        }

        const lastRun = item.repeat.nextRun || item.startTime;
        if (!lastRun) return null;

        const frequency = item.repeat.frequency;
        const interval = item.repeat.interval || 1;
        const nextRun = new Date(lastRun);

        switch (frequency) {
            case 'Daily':
                nextRun.setDate(nextRun.getDate() + interval);
                break;
            case 'Weekly':
                nextRun.setDate(nextRun.getDate() + (7 * interval));
                break;
            case 'Monthly':
                nextRun.setMonth(nextRun.getMonth() + interval);
                break;
            case 'Yearly':
                nextRun.setFullYear(nextRun.getFullYear() + interval);
                break;
            case 'Custom':
                if (item.repeat.customPattern) {
                    // Handle custom pattern (e.g., specific days of week)
                    const daysToAdd = this.calculateCustomPatternDays(item.repeat.customPattern, nextRun);
                    nextRun.setDate(nextRun.getDate() + daysToAdd);
                }
                break;
            default:
                return null;
        }

        // Check if we've reached the end condition
        if (this.shouldEndRepeating(item, nextRun)) {
            return null;
        }

        return nextRun;
    }

    /**
     * Calculate days to add for custom repeat patterns
     */
    private calculateCustomPatternDays(pattern: {
        daysOfWeek?: number[];
        daysOfMonth?: number[];
        monthsOfYear?: number[];
        interval?: number;
    }, currentDate: Date): number {
        if (pattern.daysOfWeek) {
            // Find next occurrence of specified days
            let daysToAdd = 1;
            while (daysToAdd <= 7) {
                const nextDate = new Date(currentDate);
                nextDate.setDate(nextDate.getDate() + daysToAdd);
                if (pattern.daysOfWeek.includes(nextDate.getDay())) {
                    return daysToAdd;
                }
                daysToAdd++;
            }
        }
        return 1; // Default to next day if no pattern matches
    }

    /**
     * Check if repeating should end based on conditions
     */
    private shouldEndRepeating(item: IEvent | ITask, nextRun: Date): boolean {
        if (!item.repeat?.endCondition) {
            return false;
        }

        switch (item.repeat.endCondition) {
            case 'Never':
                return false;
            case 'UntilDate':
                return item.repeat.endDate ? nextRun > item.repeat.endDate : false;
            case 'AfterOccurrences':
                return item.repeat.occurrences ? item.repeat.occurrences <= 0 : false;
            default:
                return false;
        }
    }

    /**
     * Process all due reminders
     */
    async processDueReminders(): Promise<void> {
        const now = new Date();
        try {
            // Process event reminders
            const dueEventReminders = await this.findDueReminders(Event, now);
            await this.processReminders(dueEventReminders, 'event');

            // Process task reminders
            const dueTaskReminders = await this.findDueReminders(Task, now);
            await this.processReminders(dueTaskReminders, 'task');

            // Process list item reminders
            const lists = await List.find({});
            for (const list of lists) {
                let needsSave = false;
                
                // Update outdated visibility values
                if (String(list.visibility) === 'Everyone (Public)') {
                    list.visibility = 'Public';
                    needsSave = true;
                } else if (String(list.visibility) === 'Private') {
                    // Use the visibility mapper to convert 'Private' to 'ConnectionsOnly'
                    list.visibility = mapExternalToInternal('Private' as any);
                    needsSave = true;
                    logger.info(`Migrated list ${list._id} visibility from 'Private' to '${list.visibility}'`);
                }
                
                // Save the list if visibility was updated
                if (needsSave) {
                    await list.save();
                }
                
                for (let i = 0; i < list.items.length; i++) {
                    const item = list.items[i];
                    if (item.reminders && Array.isArray(item.reminders)) {
                        for (let j = 0; j < item.reminders.length; j++) {
                            const reminder = item.reminders[j];
                            if (!reminder.triggered && reminder.triggerTime && reminder.triggerTime <= now) {
                                try {
                                    await this.sendReminder({
                                        ...item,
                                        _id: list._id,
                                        listName: list.name,
                                        itemIndex: i
                                    }, reminder, j, 'list');
                                } catch (error) {
                                    logger.error(`Failed to send reminder for list ${list._id} item ${i}:`, error);
                                    // Mark as failed
                                    item.reminders[j].triggered = false;
                                }
                            }
                        }
                    }
                }
                
                // Only save again if there were reminder updates
                if (!needsSave) {
                    await list.save();
                }
            }
        } catch (error) {
            logger.error('Error in processDueReminders:', error);
            throw error;
        }
    }

    /**
     * Find due reminders for a given model
     */
    private async findDueReminders(Model: Model<any>, now: Date): Promise<any[]> {
        let retries = 0;
        while (retries < this.MAX_RETRIES) {
            try {
                return await Model.find({
                    'reminders.triggered': false,
                    'reminders.triggerTime': { $lte: now }
                });
            } catch (error) {
                retries++;
                if (retries === this.MAX_RETRIES) {
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
            }
        }
        return [];
    }

    /**
     * Process reminders for a collection of items
     */
    private async processReminders(items: any[], itemType: 'event' | 'task' | 'list'): Promise<void> {
        for (const item of items) {
            for (let i = 0; i < item.reminders.length; i++) {
                const reminder = item.reminders[i];
                if (!reminder.triggered && reminder.triggerTime && reminder.triggerTime <= new Date()) {
                    try {
                        await this.sendReminder(item, reminder, i, itemType);
                    } catch (error) {
                        logger.error(`Failed to send reminder for ${itemType} ${item._id}:`, error);
                        await this.updateReminderStatus((item._id as mongoose.Types.ObjectId).toString(), i, 'failed', itemType as any);
                    }
                }
            }
        }
    }

    /**
     * Send reminder notifications (supports event, task, list)
     */
    private async sendReminder(
        item: any,
        reminder: Reminder,
        reminderIndex: number,
        itemType: 'event' | 'task' | 'list'
    ): Promise<void> {
        // Get recipients
        const recipients = reminder.customEmail ? [reminder.customEmail] : [item.createdBy];
        // Get item title and time
        let itemTitle = '';
        let itemTime: Date | undefined;
        let actionUrl = '';
        let metadata: any = {};

        if (itemType === 'event' || itemType === 'task') {
            itemTitle = item.title;
            itemTime = item.startTime;
            actionUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/${itemType}s/${item._id}`;
            
            // Get user's timezone settings for proper time formatting
            const userSettings = await this.settingsService.getSettings(item.createdBy.toString());
            const userTimezone = userSettings?.general?.time?.timeZone || 'UTC';
            const timeFormat = userSettings?.general?.time?.timeFormat || '24h';
            
            // Enhanced metadata for events and tasks
            metadata = {
                itemId: item._id,
                itemType,
                reminderType: reminder.type,
                itemTitle,
                startTime: itemTime,
                description: item.description || '',
                category: item.category || '',
                priority: item.priority || 'medium',
                location: item.location || '',
                timeUntilEvent: itemTime ? this.calculateTimeUntil(itemTime, userTimezone) : 'Unknown',
                userTimezone,
                formattedStartTime: itemTime ? await this.formatTimeForUser(itemTime, userTimezone, item.createdBy?.toString() || item.profile?.toString()) : undefined,
            };

            // Event-specific metadata
            if (itemType === 'event') {
                metadata.eventType = item.eventType || 'meeting';
                metadata.participants = item.participants || [];
                metadata.endTime = item.endTime;
                metadata.duration = item.duration;
                metadata.formattedEndTime = item.endTime ? await this.formatTimeForUser(item.endTime, userTimezone, item.createdBy?.toString() || item.profile?.toString()) : undefined;
            }

            // Task-specific metadata
            if (itemType === 'task') {
                metadata.status = item.status || 'pending';
                metadata.dueDate = item.dueDate || itemTime;
                metadata.estimatedDuration = item.estimatedDuration;
                metadata.tags = item.tags || [];
                metadata.formattedDueDate = (item.dueDate || itemTime) ? await this.formatTimeForUser(item.dueDate || itemTime, userTimezone, item.createdBy?.toString() || item.profile?.toString()) : undefined;
            }
        } else if (itemType === 'list') {
            itemTitle = `${item.listName || 'List'}: ${item.name}`;
            itemTime = item.dueDate || item.createdAt;
            actionUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/lists/${item._id}`;
            
            // Get user's timezone settings for list items
            const userSettings = await this.settingsService.getSettings(item.createdBy?.toString() || item.profile?.toString());
            const userTimezone = userSettings?.general?.time?.timeZone || 'UTC';
            
            metadata = {
                itemId: item._id,
                itemType,
                reminderType: reminder.type,
                itemTitle,
                startTime: itemTime,
                description: item.description || '',
                listName: item.listName || 'List',
                timeUntilEvent: itemTime ? this.calculateTimeUntil(itemTime, userTimezone) : 'Unknown',
                userTimezone,
                formattedTime: itemTime ? await this.formatTimeForUser(itemTime, userTimezone, item.createdBy?.toString() || item.profile?.toString()) : undefined,
            };
        }

        if (!itemTime) {
            throw new Error('Item time is required');
        }

        let notificationSent = false;
        let emailSent = false;

        for (const recipientId of recipients) {
            try {
                // Validate recipientId
                if (!mongoose.Types.ObjectId.isValid(recipientId)) {
                    console.log(recipientId);
                    logger.error(`Invalid recipient ID: ${recipientId}`);
                    continue;
                }

                await this.notificationService.createNotification({
                    recipient: new mongoose.Types.ObjectId(recipientId.toString()),
                    type: 'reminder',
                    title: `Reminder: ${itemTitle}`,
                    message: `${itemType === 'event' ? 'Event' : itemType === 'task' ? 'Task' : 'List Item'} "${itemTitle}" is due soon`,
                    relatedTo: {
                        model: itemType === 'event' ? 'Event' : itemType === 'task' ? 'Task' : 'List',
                        id: item._id
                    },
                    action: {
                        url: actionUrl,
                        text: `View ${itemType === 'event' ? 'Event' : itemType === 'task' ? 'Task' : 'List Item'}`
                    },
                    priority: 'high',
                    isRead: false,
                    isArchived: false,
                    metadata: metadata
                });
                notificationSent = true;

                // The email will now be sent automatically by the notification service
                // using our new templates, so we don't need to send it manually here
                emailSent = true;

            } catch (error) {
                logger.error(`Failed to send notification for ${itemType} ${item._id} to recipient ${recipientId}:`, error);
            }
        }

        if (notificationSent || emailSent) {
            if (itemType === 'list') {
                // Mark reminder as sent for list item
                item.reminders[reminderIndex].triggered = true;
            } else {
                await this.updateReminderStatus(
                    (item._id as mongoose.Types.ObjectId).toString(),
                    reminderIndex,
                    'sent',
                    itemType as any
                );
            }
        } else {
            throw new Error('Failed to send any notifications');
        }
    }

    /**
     * Calculate time until event in a human-readable format with timezone awareness
     */
    private calculateTimeUntil(eventTime: Date, userTimezone: string = 'UTC'): string {
        try {
            const timeDiff = TimezoneUtils.calculateTimeDifferenceInUserTimezone(
                new Date(),
                eventTime,
                userTimezone
            );
            
            return timeDiff.humanReadable;
        } catch (error) {
            logger.error(`Error calculating time until event: ${error}`);
            return 'Unknown';
        }
    }

    /**
     * Format time for user based on their timezone and time format preferences
     */
    private async formatTimeForUser(time: Date, userTimezone: string, userId: string): Promise<string> {
        try {
            return await TimezoneUtils.formatDateForUser(
                time,
                userId,
                { includeTime: true, includeDate: true, includeTimezone: true }
            );
        } catch (error) {
            logger.error(`Error formatting time for user: ${error}`);
            return time.toISOString();
        }
    }

    /**
     * Calculate reminder time based on start time and reminder settings with timezone awareness
     */
    private async calculateReminderTime(
        itemTime: Date,
        reminderType: ReminderType,
        customValue?: number,
        customUnit?: 'minutes' | 'hours' | 'days' | 'weeks',
        userTimezone: string = 'UTC'
    ): Promise<Date> {
        try {
            // Convert item time to user's timezone for accurate calculations
            const adjustedItemTime = TimezoneUtils.convertToUserTimezone(itemTime, userTimezone);
            
            let reminderTime: Date;

            switch (reminderType) {
                case ReminderType.Minutes15:
                    reminderTime = new Date(adjustedItemTime.getTime() - 15 * 60 * 1000);
                    break;
                case ReminderType.Minutes30:
                    reminderTime = new Date(adjustedItemTime.getTime() - 30 * 60 * 1000);
                    break;
                case ReminderType.Hours1:
                    reminderTime = new Date(adjustedItemTime.getTime() - 60 * 60 * 1000);
                    break;
                case ReminderType.Hours2:
                    reminderTime = new Date(adjustedItemTime.getTime() - 2 * 60 * 60 * 1000);
                    break;
                case ReminderType.Days1:
                    reminderTime = new Date(adjustedItemTime.getTime() - 24 * 60 * 60 * 1000);
                    break;
                case ReminderType.Days2:
                    reminderTime = new Date(adjustedItemTime.getTime() - 2 * 24 * 60 * 60 * 1000);
                    break;
                case ReminderType.Weeks1:
                    reminderTime = new Date(adjustedItemTime.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case ReminderType.Custom:
                    if (!customValue || !customUnit) {
                        throw new Error('Custom reminder requires value and unit');
                    }
                    
                    let multiplier = 1;
                    switch (customUnit) {
                        case 'minutes':
                            multiplier = 60 * 1000;
                            break;
                        case 'hours':
                            multiplier = 60 * 60 * 1000;
                            break;
                        case 'days':
                            multiplier = 24 * 60 * 60 * 1000;
                            break;
                        case 'weeks':
                            multiplier = 7 * 24 * 60 * 60 * 1000;
                            break;
                    }
                    
                    reminderTime = new Date(adjustedItemTime.getTime() - customValue * multiplier);
                    break;
                default:
                    throw new Error(`Unsupported reminder type: ${reminderType}`);
            }

            return reminderTime;
        } catch (error) {
            logger.error(`Error calculating reminder time: ${error}`);
            throw error;
        }
    }

    /**
     * Get all reminders for an event or task
     */
    async getReminders(itemId: string, itemType: 'event' | 'task' = 'event'): Promise<Reminder[]> {
        const Model = (itemType === 'event' ? Event : Task) as Model<IEvent | ITask>;
        const item = await Model.findById(itemId);
        if (!item) {
            throw new Error(`${itemType} not found`);
        }

        return item.reminders || [];
    }

    /**
     * Delete a reminder from an event or task by reminderId
     */
    async deleteReminder(
        itemId: string,
        reminderId: string,
        itemType: 'event' | 'task' = 'event'
    ): Promise<void> {
        const Model = (itemType === 'event' ? Event : Task) as Model<IEvent | ITask>;
        const item = await Model.findById(itemId);
        if (!item) {
            throw new Error(`${itemType} not found`);
        }

        // Find the reminder index, safely handling undefined _id
        const reminderIndex = item.reminders.findIndex(reminder => 
            reminder._id && reminder._id.toString() === reminderId
        );
        
        if (reminderIndex === -1) {
            throw new Error('Reminder not found');
        }

        // Remove the reminder at the found index
        item.reminders.splice(reminderIndex, 1);
        await item.save();
    }

    /**
     * Cancel all future reminders for an event or task
     */
    async cancelAllReminders(
        itemId: string,
        itemType: 'event' | 'task' = 'event'
    ): Promise<IEvent | ITask> {
        const Model = (itemType === 'event' ? Event : Task) as Model<IEvent | ITask>;
        const item = await Model.findById(itemId);
        if (!item) {
            throw new Error(`${itemType} not found`);
        }

        // Mark all untriggered reminders as triggered
        if (item.reminders) {
            item.reminders.forEach(reminder => {
                if (!reminder.triggered) {
                    reminder.triggered = true;
                    reminder.triggerTime = new Date();
                }
            });
        }

        await item.save();
        return item;
    }

    /**
     * Get all reminders for a user across events, tasks, lists, and list items
     */
    async getAllRemindersForUser(profileId: string) {
        // Events
        const events = await Event.find({ profile: profileId }, 'reminders title startTime');
        // Tasks
        const tasks = await Task.find({ profile: profileId }, 'reminders title startTime');
        // Lists and list items
        const lists = await List.find({ profile: profileId }, 'name items');
        // Flatten all reminders
        const reminders = [
            ...events.flatMap(e => (e.reminders || []).map(r => ({ ...r, itemType: 'event', itemId: e._id, title: e.title, time: e.startTime }))),
            ...tasks.flatMap(t => (t.reminders || []).map(r => ({ ...r, itemType: 'task', itemId: t._id, title: t.title, time: t.startTime }))),
            ...lists.flatMap(l =>
                (l.items || []).flatMap((item, idx) =>
                    (item.reminders || []).map(r => ({
                        ...r,
                        itemType: 'list',
                        itemId: l._id,
                        listName: l.name,
                        itemIndex: idx,
                        title: item.name,
                        time: item.createdAt
                    }))
                )
            )
        ];
        return reminders;
    }
}

export default new ReminderService(); 