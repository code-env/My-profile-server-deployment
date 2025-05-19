import { Event } from '../models/Event';
import { Task } from '../models/Tasks';
import { IEvent } from '../models/Event';
import { ITask } from '../models/Tasks';
import { Reminder, ReminderType, ReminderUnit } from '../models/plans-shared';
import { NotificationService } from './notification.service';
import EmailService from './email.service';
import mongoose, { Model } from 'mongoose';
import { logger } from '../utils/logger';
import { List, IList } from '../models/List';
import { VisibilityType } from '../models/plans-shared';

class ReminderService {
    private notificationService: NotificationService;
    private emailService: EmailService;
    private readonly MAX_RETRIES = 3;
    private readonly RETRY_DELAY = 5000; // 5 seconds

    constructor() {
        this.notificationService = new NotificationService();
        this.emailService = new EmailService();
    }

    /**
     * Add a reminder to an event, task, or list item
     */
    async addReminder(
        itemId: string,
        userId: string,
        reminder: {
            type: ReminderType;
            value: number;
            unit: ReminderUnit;
            message?: string;
            recipients?: string[];
        },
        itemType: 'event' | 'task' | 'list' = 'event',
        itemIndex?: number // For list item
    ): Promise<IEvent | ITask | IList> {
        let Model: Model<any>;
        if (itemType === 'event') Model = Event;
        else if (itemType === 'task') Model = Task;
        else Model = List;
        const item = await Model.findOne({ _id: itemId, createdBy: userId });
        if (!item) {
            throw new Error(`${itemType} not found or access denied`);
        }
        if (itemType === 'list' && typeof itemIndex === 'number') {
            // Add reminder to a list item
            const listItem = item.items[itemIndex];
            if (!listItem) throw new Error('List item not found');
            listItem.reminders = listItem.reminders || [];
            const baseTime = listItem.createdAt || new Date();
            const reminderTime = this.calculateReminderTime(
                baseTime,
                reminder.value,
                reminder.unit
            );
            listItem.reminders.push({
                type: reminder.type,
                amount: reminder.value,
                unit: reminder.unit,
                customEmail: reminder.recipients?.[0],
                triggered: false,
                triggerTime: reminderTime,
                minutesBefore: reminder.unit === 'Minutes' ? reminder.value : undefined
            });
        } else {
            // Add reminder to event or task
            const baseTime = item.startTime || new Date();
            const reminderTime = this.calculateReminderTime(
                baseTime,
                reminder.value,
                reminder.unit
            );
            item.reminders = item.reminders || [];
            item.reminders.push({
                type: reminder.type,
                amount: reminder.value,
                unit: reminder.unit,
                customEmail: reminder.recipients?.[0],
                triggered: false,
                triggerTime: reminderTime,
                minutesBefore: reminder.unit === 'Minutes' ? reminder.value : undefined
            });
        }
        await item.save();
        return item;
    }

    /**
     * Update reminder status and calculate next trigger time for repeating events
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
                    
                    // Calculate and set next reminder time
                    reminder.triggerTime = this.calculateReminderTime(
                        nextEventTime,
                        reminder.amount || 0,
                        reminder.minutesBefore ? ReminderUnit.Minutes : ReminderUnit.Hours
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
     * Process due reminders for events, tasks, and lists
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
                // Update outdated visibility values
                if (String(list.visibility) === 'Everyone (Public)') {
                    list.visibility = VisibilityType.Public;
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
                await list.save();
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
        if (itemType === 'event' || itemType === 'task') {
            itemTitle = item.title;
            itemTime = item.startTime;
        } else if (itemType === 'list') {
            itemTitle = `${item.listName || 'List'}: ${item.name}`;
            itemTime = item.dueDate || item.createdAt;
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
                    priority: 'high',
                    isRead: false,
                    isArchived: false,
                    metadata: {
                        itemId: item._id,
                        itemType,
                        reminderType: reminder.type,
                        itemTitle,
                        startTime: itemTime
                    }
                });
                notificationSent = true;
                // Send email notification
                const user = await mongoose.model('User').findById(recipientId);
                if (user?.email) {
                    const emailContent = `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2 style="color: #333;">Reminder: ${itemTitle}</h2>
                            <p>${itemType === 'event' ? 'Event' : itemType === 'task' ? 'Task' : 'List Item'} "${itemTitle}" is due soon</p>
                            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                                <p><strong>Details:</strong></p>
                                <p>Due Time: ${itemTime.toLocaleString()}</p>
                                <p><a href="/${itemType}s/${item._id}" style="color: #007bff; text-decoration: none;">View Details</a></p>
                            </div>
                        </div>
                    `;
                    await EmailService.sendEmail(
                        user.email,
                        `Reminder: ${itemTitle}`,
                        emailContent
                    );
                    emailSent = true;
                }
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
     * Calculate reminder time based on start time and reminder settings
     */
    private calculateReminderTime(
        itemTime: Date,
        value: number,
        unit: ReminderUnit
    ): Date {
        const reminderTime = new Date(itemTime);

        switch (unit) {
            case 'Minutes':
                reminderTime.setMinutes(reminderTime.getMinutes() - value);
                break;
            case 'Hours':
                reminderTime.setHours(reminderTime.getHours() - value);
                break;
            case 'Days':
                reminderTime.setDate(reminderTime.getDate() - value);
                break;
            case 'Weeks':
                reminderTime.setDate(reminderTime.getDate() - (value * 7));
                break;
        }

        return reminderTime;
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