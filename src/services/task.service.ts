import mongoose, { Types } from 'mongoose';
import { ISubTask, RepeatSettings, Reminder, Reward, Attachment, Comment, Location, PriorityLevel, TaskCategory, ReminderType, ReminderUnit } from '../models/plans-shared';
import { IUser, User } from '../models/User';
import { IProfile } from '../interfaces/profile.interface';
import { TaskStatus } from 'twilio/lib/rest/taskrouter/v1/workspace/task';
import { List } from '../models/List';
import { ITask, Task } from '../models/Tasks';
import { checkTimeOverlap } from '../utils/timeUtils';
import { SettingsService } from './settings.service';
import { taskSettingsIntegration } from '../utils/taskSettingsIntegration';
import { mapExternalToInternal } from '../utils/visibilityMapper';
import { TimezoneUtils } from '../utils/timezoneUtils';
import createHttpError from 'http-errors';

class TaskService {
    private settingsService = new SettingsService();

    /**
     * Create a new task with all fields and apply user settings
     */
    async createTask(taskData: Partial<ITask>): Promise<ITask> {
        // Apply user settings defaults using the integration utility
        const enhancedTaskData = await taskSettingsIntegration.applyUserDefaultsToTask(
            taskData.createdBy?.toString() || '', 
            taskData
        );

        // Check for time overlap if the task has a time range
        if (enhancedTaskData.startTime && enhancedTaskData.endTime) {
            const overlapCheck = await checkTimeOverlap(
                enhancedTaskData.createdBy?.toString() || '',
                enhancedTaskData.profile?.toString() || '',
                {
                    startTime: enhancedTaskData.startTime,
                    endTime: enhancedTaskData.endTime,
                    isAllDay: enhancedTaskData.isAllDay || false
                }
            );

            if (overlapCheck.overlaps) {
                throw new Error(`Time conflict with existing items: ${overlapCheck.conflictingItems.map(item => `${item.type}: ${item.title}`).join(', ')}`);
            }
        }

        // Process reminders to calculate trigger times with timezone awareness
        if (enhancedTaskData.startTime && (!enhancedTaskData.reminders || enhancedTaskData.reminders.length === 0)) {
            // Mark that this task needs reminder processing
            (enhancedTaskData as any).needsReminderProcessing = true;
        } else if (enhancedTaskData.reminders && Array.isArray(enhancedTaskData.reminders) && enhancedTaskData.startTime) {
            // Process existing reminders to calculate trigger times
            const userId = enhancedTaskData.createdBy?.toString();
            enhancedTaskData.reminders = await Promise.all(
                enhancedTaskData.reminders.map(async reminder => ({
                    ...reminder,
                    triggered: false,
                    triggerTime: await this.calculateReminderTime(
                        enhancedTaskData.startTime!,
                        reminder.amount || this.getMinutesFromReminderType(reminder.type),
                        userId
                    )
                }))
            );
        }

        const task = new Task({
            ...enhancedTaskData,
            type: enhancedTaskData.type || 'Todo',
            createdBy: enhancedTaskData.createdBy || null,
            profile: enhancedTaskData.profile|| null,
            subTasks: enhancedTaskData.subTasks || [],
            isAllDay: enhancedTaskData.isAllDay || false,
            repeat: enhancedTaskData.repeat || {
                isRepeating: false,
                frequency: 'None',
                endCondition: 'Never'
            },
            reminders: enhancedTaskData.reminders || [],
            visibility: enhancedTaskData.visibility || 'Public',
            participants: enhancedTaskData.participants || [],
            color: enhancedTaskData.color || '#1DA1F2',
            category: enhancedTaskData.category || 'Personal',
            priority: enhancedTaskData.priority || 'Low',
            status: enhancedTaskData.status || 'Upcoming',
            attachments: enhancedTaskData.attachments || [],
            comments: enhancedTaskData.comments || [],
        });

        // Handle all-day event adjustments
        if (task.isAllDay) {
            this.adjustAllDayEvent(task);
        }

        await task.save();

        // Process reminders asynchronously in background
        if ((enhancedTaskData as any).needsReminderProcessing) {
            this.processRemindersAsync((task._id as Types.ObjectId).toString(), enhancedTaskData.createdBy?.toString()).catch((error: any) => {
                console.error('Failed to process reminders for task:', task._id, error);
            });
        }

        // If subtasks exist, create lists for each
        if (task.subTasks && task.subTasks.length > 0) {
            await this.createListsFromSubtasks(task);
        }

        return task.toObject();
    }

    private async createListsFromSubtasks(task: ITask): Promise<void> {
        console.log(task);
        const listPromise = new List({
            name: task.title || 'New List',
            type: 'Todo',
            createdBy: task.createdBy,
            relatedTask: task._id,
            items: task.subTasks.map((subTask: ISubTask) => ({
                name: subTask.description || 'Complete subtask',
                isCompleted: subTask.isCompleted || false,
                createdAt: subTask.createdAt || new Date()
            })),
            // Copy relevant properties from the task
            visibility: mapExternalToInternal(task.visibility as any),
            color: task.color,
            profile: task.profile,
            priority: task.priority,
            category: task.category
        });
        await listPromise.save();
        task.relatedList = listPromise._id as mongoose.Types.ObjectId;

    }

    private adjustAllDayEvent(task: ITask): void {
        if (!task.startTime) task.startTime = new Date();

        // Set start to midnight
        const start = new Date(task.startTime);
        start.setHours(0, 0, 0, 0);
        task.startTime = start;

        // Set end to 23:59:59
        const end = new Date(start);
        end.setHours(23, 59, 59, 999);
        task.endTime = end;

        // Set duration to 24 hours
        task.duration = { hours: 24, minutes: 0 };
    }

    /**
     * Get task by ID with populated fields
     */
    async getTaskById(taskId: string) {
        const task = await Task.findById(taskId)
            .populate('createdBy', 'name email')
            .populate('profile', 'profileInformation.username')
            .populate('participants', 'profileInformation.username')
            .populate('comments.postedBy', 'profileInformation.username')
            .lean();

        if (!task) {
            throw new Error('Task not found');
        }

        return task;
    }

    /**
     * Get all tasks for a user with filters and apply privacy settings
     */
    async getUserTasks(
        userId: string,
        profileId: string,
        filters: {
            status?: TaskStatus;
            priority?: PriorityLevel;
            category?: TaskCategory;
            search?: string;
            isAllDay?: boolean;
            profile?: string;
            fromDate?: Date;
            toDate?: Date;
        } = {},
        page: number = 1,
        limit: number = 20
    ): Promise<{
        tasks: ITask[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            pages: number;
            hasNext: boolean;
            hasPrev: boolean;
        };
    }> {
        // Query for tasks created by the user OR associated with the profile
        const query: any = {
            $or: [
                { createdBy: userId },
                { profile: profileId }
            ]
        };

        // Apply filters
        if (filters.status) query.status = filters.status;
        if (filters.priority) query.priority = filters.priority;
        if (filters.category) query.category = filters.category;
        if (filters.isAllDay !== undefined) query.isAllDay = filters.isAllDay;
        if (filters.profile) query.profile = filters.profile;

        // Date range filtering
        if (filters.fromDate || filters.toDate) {
            if (!query.$and) query.$and = [];
            if (filters.fromDate) {
                query.$and.push({
                    $or: [
                        { startTime: { $gte: filters.fromDate } },
                        { endTime: { $gte: filters.fromDate } },
                        { 'repeat.nextRun': { $gte: filters.fromDate } }
                    ]
                });
            }
            if (filters.toDate) {
                query.$and.push({
                    $or: [
                        { startTime: { $lte: filters.toDate } },
                        { endTime: { $lte: filters.toDate } },
                        { 'repeat.nextRun': { $lte: filters.toDate } }
                    ]
                });
            }
        }

        // Search across multiple fields
        if (filters.search) {
            const searchRegex = new RegExp(filters.search, 'i');
            if (!query.$and) query.$and = [];
            query.$and.push({
                $or: [
                    { title: searchRegex },
                    { description: searchRegex },
                    { notes: searchRegex },
                ]
            });
        }

        // Get total count for pagination
        const total = await Task.countDocuments(query);

        // Calculate pagination values
        const skip = (page - 1) * limit;
        const pages = Math.ceil(total / limit);
        const hasNext = page < pages;
        const hasPrev = page > 1;

        const tasks = await Task.find(query)
            .sort({
                priority: -1,
                startTime: 1,
                createdAt: -1
            })
            .skip(skip)
            .limit(limit)
            .populate('createdBy', 'Information.username')
            .populate('participants', 'profileInformation.username')
            .populate('profile', 'profileInformation.username')
            .lean();

        // Apply privacy filtering based on user settings
        const filteredTasks = await this.applyPrivacyFiltering(tasks, userId, profileId);

        return {
            tasks: filteredTasks,
            pagination: {
                page,
                limit,
                total,
                pages,
                hasNext,
                hasPrev
            }
        };
    }

    /**
     * Apply privacy filtering to tasks based on user settings
     */
    private async applyPrivacyFiltering(tasks: ITask[], requestingUserId: string, requestingProfileId: string): Promise<ITask[]> {
        const filteredTasks: ITask[] = [];

        for (const task of tasks) {
            // Extract the actual ID from createdBy (it might be populated)
            const taskCreatedById = task.createdBy?._id?.toString() || task.createdBy?.toString();
            const taskProfileId = task.profile?._id?.toString() || task.profile?.toString();
            
            // If it's the user's own task OR associated with their profile, always show it
            if (taskCreatedById === requestingUserId || taskProfileId === requestingProfileId) {
                filteredTasks.push(task);
                continue;
            }

            // Check visibility for the requesting user's profile
            const visible = await taskSettingsIntegration.isTaskVisibleToProfile(task, requestingProfileId);
            if (visible) {
                filteredTasks.push(task);
            }
        }
        
        return filteredTasks;
    }

    /**
     * Update a task
     */
    async updateTask(
        taskId: string,
        userId: string,
        updateData: Partial<ITask>
    ): Promise<ITask> {
        // Handle all-day event adjustments
        if (updateData.isAllDay) {
            this.adjustAllDayEvent(updateData as ITask);
        }

        console.log('Update Data:', updateData.attachments);
        if (updateData.subTasks && updateData.subTasks.length > 0) {
            await this.createListsFromSubtasks(updateData as ITask);
        }

        if (updateData.attachments && updateData.attachments.length > 0) {
            updateData.attachments = updateData.attachments.map(attachment => ({
                ...attachment,
                uploadedAt: new Date(),
            }));
        }

        const task = await Task.findOneAndUpdate(
            { _id: taskId, createdBy: userId },
            updateData,
            { new: true, runValidators: true }
        );

        if (!task) {
            throw new Error('Task not found or access denied');
        }

        return task.toObject();
    }

    /**
     * Delete a task
     */
    async deleteTask(taskId: string, userId: string): Promise<boolean> {
        // First check if task exists
        const task = await Task.findById(taskId);
        if (!task) {
            throw createHttpError(404, 'Task not found');
        }

        // Then check if user has access
        if (task.createdBy.toString() !== userId) {
            throw createHttpError(403, 'Access denied');
        }

        // Finally delete the task
        await task.deleteOne();
        return true;
    }

    /**
     * Add a subtask to a task
     */
    async addSubTask(
        taskId: string,
        userId: string,
        subTaskData: ISubTask
    ): Promise<ITask> {
        const subTask: ISubTask = {
            description: subTaskData.description,
            isCompleted: subTaskData.isCompleted || false,
            createdAt: new Date(),
            completedAt: subTaskData.isCompleted ? new Date() : undefined
        };

        const task = await Task.findOneAndUpdate(
            { _id: taskId, createdBy: userId },
            { $push: { subTasks: subTask } },
            { new: true }
        );

        if (!task) {
            throw new Error('Task not found or access denied');
        }

        return task;
    }

    /**
     * Update a subtask
     */
    async updateSubTask(
        taskId: string,
        userId: string,
        subTaskIndex: number,
        updateData: Partial<ISubTask>
    ): Promise<ITask> {
        const task = await Task.findOne({ _id: taskId, createdBy: userId });
        if (!task) {
            throw new Error('Task not found or access denied');
        }

        if (subTaskIndex < 0 || subTaskIndex >= task.subTasks.length) {
            throw new Error('Invalid subtask index');
        }

        // Update subtask
        const subTask = task.subTasks[subTaskIndex];
        if (updateData.description !== undefined) {
            subTask.description = updateData.description;
        }
        if (updateData.isCompleted !== undefined) {
            subTask.isCompleted = updateData.isCompleted;
            subTask.completedAt = updateData.isCompleted ? new Date() : undefined;
        }

        await task.save();
        return task;
    }

    /**
     * Delete a subtask
     */
    async deleteSubTask(
        taskId: string,
        userId: string,
        subTaskIndex: number
    ): Promise<ITask> {
        const task = await Task.findOne({ _id: taskId, createdBy: userId });
        if (!task) {
            throw new Error('Task not found or access denied');
        }

        if (subTaskIndex < 0 || subTaskIndex >= task.subTasks.length) {
            throw new Error('Invalid subtask index');
        }

        task.subTasks.splice(subTaskIndex, 1);
        await task.save();
        return task;
    }

    /**
     * Add a comment to a task
     */
    async addComment(
        taskId: string,
        profileId: string,
        text: string
    ): Promise<ITask> {
        const comment = {
            text,
            postedBy: new mongoose.Types.ObjectId(profileId),
            createdAt: new Date(),
            updatedAt: new Date(),
            likes: []
        };

        const task = await Task.findOneAndUpdate(
            { _id: taskId },
            { $push: { comments: comment } },
            { new: true, runValidators: false }
        );

        if (!task) {
            throw new Error('Task not found');
        }

        return task;
    }

    /**
     * Like a comment on a task
     */
    async likeComment(
        taskId: string,
        commentIndex: number,
        profileId: string
    ): Promise<ITask> {
        const task = await Task.findOne({ _id: taskId });
        if (!task) {
            throw new Error('Task not found');
        }

        if (commentIndex < 0 || commentIndex >= task.comments.length) {
            throw new Error('Invalid comment index');
        }

        const comment = task.comments[commentIndex];
        const profileIdObj = new mongoose.Types.ObjectId(profileId);

        if (!comment.likes.includes(profileIdObj)) {
            comment.likes.push(profileIdObj);
        }

        await task.save();
        return task;
    }

    /**
     * Unlike a comment on a task
     */
    async unlikeComment(
        taskId: string,
        commentIndex: number,
        profileId: string
    ): Promise<ITask> {
        const task = await Task.findOne({ _id: taskId });
        if (!task) {
            throw new Error('Task not found');
        }

        if (commentIndex < 0 || commentIndex >= task.comments.length) {
            throw new Error('Invalid comment index');
        }

        const comment = task.comments[commentIndex];
        const profileIdObj = new mongoose.Types.ObjectId(profileId);

        comment.likes = comment.likes.filter(id => !id.equals(profileIdObj));
        await task.save();

        return task;
    }

    /**
     * Add an attachment to a task
     */
    async addAttachment(
        taskId: string,
        userId: string,
        profileId: string,
        attachmentData: Omit<Attachment, 'uploadedAt' | 'uploadedBy'>
    ): Promise<ITask> {
        const attachment: Attachment = {
            ...attachmentData,
            uploadedAt: new Date(),
            uploadedBy: new mongoose.Types.ObjectId(profileId)
        };

        const task = await Task.findOneAndUpdate(
            { _id: taskId, createdBy: userId },
            { $push: { attachments: attachment } },
            { new: true }
        );

        if (!task) {
            throw new Error('Task not found or access denied');
        }

        return task;
    }

    /**
     * Remove an attachment from a task
     */
    async removeAttachment(
        taskId: string,
        profileId: string,
        attachmentIndex: number
    ): Promise<ITask> {
        const task = await Task.findOne({ _id: taskId, profile: profileId });
        if (!task) {
            throw new Error('Task not found or access denied');
        }

        if (attachmentIndex < 0 || attachmentIndex >= task.attachments.length) {
            throw new Error('Invalid attachment index');
        }

        task.attachments.splice(attachmentIndex, 1);
        await task.save();
        return task;
    }

    async likeTask(taskId: string, profileId: Types.ObjectId) {
        const task = await Task.findOneAndUpdate(
            { _id: taskId },
            { $addToSet: { likes: profileId } },
            { new: true, runValidators: false }
        );

        if (!task) {
            throw new Error('Task not found');
        }

        return task;
    }

    async unlikeTask(taskId: string, profileId: Types.ObjectId) {
        const task = await Task.findOneAndUpdate(
            { _id: taskId },
            { $pull: { likes: profileId } },
            { new: true, runValidators: false }
        );

        if (!task) {
            throw new Error('Task not found');
        }

        return task;
    }

    /**
     * Update task settings
     */
    async updateTaskSettings(
        taskId: string,
        userId: string,
        settingsUpdate: Partial<ITask['settings']>
    ): Promise<ITask> {
        const task = await Task.findOne({ _id: taskId, createdBy: userId });
        
        if (!task) {
            throw new Error('Task not found or unauthorized');
        }

        // Check if settingsUpdate is provided
        if (!settingsUpdate) {
            return task;
        }

        // Merge settings
        if (!task.settings) {
            task.settings = {};
        }

        if (settingsUpdate.visibility) {
            task.settings.visibility = { ...task.settings.visibility, ...settingsUpdate.visibility };
        }
        
        if (settingsUpdate.notifications) {
            task.settings.notifications = { ...task.settings.notifications, ...settingsUpdate.notifications };
        }
        
        if (settingsUpdate.timeSettings) {
            task.settings.timeSettings = { ...task.settings.timeSettings, ...settingsUpdate.timeSettings };
        }
        
        if (settingsUpdate.privacy) {
            task.settings.privacy = { ...task.settings.privacy, ...settingsUpdate.privacy };
        }

        await task.save();
        return task;
    }

    /**
     * Get tasks visible to a specific user (for sharing/viewing)
     */
    async getVisibleTasks(
        viewerUserId: string,
        viewerProfileId: string,
        targetUserId: string,
        filters: {
            status?: TaskStatus;
            priority?: PriorityLevel;
            category?: TaskCategory;
            fromDate?: Date;
            toDate?: Date;
        } = {}
    ): Promise<ITask[]> {
        const query: any = { createdBy: targetUserId };

        // Apply filters
        if (filters.status) query.status = filters.status;
        if (filters.priority) query.priority = filters.priority;
        if (filters.category) query.category = filters.category;

        // Date range filtering
        if (filters.fromDate || filters.toDate) {
            query.$and = [];
            if (filters.fromDate) {
                query.$and.push({
                    $or: [
                        { startTime: { $gte: filters.fromDate } },
                        { endTime: { $gte: filters.fromDate } }
                    ]
                });
            }
            if (filters.toDate) {
                query.$and.push({
                    $or: [
                        { startTime: { $lte: filters.toDate } },
                        { endTime: { $lte: filters.toDate } }
                    ]
                });
            }
        }

        // Only get tasks that are visible to the viewer's profile
        query.$or = [
            { visibility: 'Public' },
            { 'settings.visibility.level': 'Public' },
            { 
                'settings.visibility.level': 'Custom',
                'settings.visibility.customUsers': viewerProfileId
            }
        ];

        return Task.find(query)
            .sort({ startTime: 1, createdAt: -1 })
            .populate('createdBy', 'Information.username')
            .populate('participants', 'profileInformation.username')
            .populate('profile', 'profileInformation.username')
            .lean();
    }

    /**
     * Calculate reminder time based on start time and minutes before with timezone awareness
     */
    private async calculateReminderTime(
        startTime: Date,
        minutesBefore: number,
        userId?: string
    ): Promise<Date> {
        try {
            // Get user timezone
            const userTimezone = userId ? await TimezoneUtils.getUserTimezone(userId) : 'UTC';
            
            // Convert start time to user's timezone for accurate calculations
            const adjustedStartTime = TimezoneUtils.convertToUserTimezone(startTime, userTimezone);
            
            // Calculate reminder time
            const reminderTime = new Date(adjustedStartTime.getTime() - minutesBefore * 60 * 1000);
            
            return reminderTime;
        } catch (error) {
            console.error('Error calculating reminder time:', error);
            // Fallback to simple calculation
            return new Date(startTime.getTime() - minutesBefore * 60 * 1000);
        }
    }

    /**
     * Get reminder type enum from minutes before
     */
    private getReminderTypeFromMinutes(minutes: number): ReminderType {
        switch (minutes) {
            case 15:
                return ReminderType.Minutes15;
            case 30:
                return ReminderType.Minutes30;
            case 60:
                return ReminderType.Hours1;
            case 120:
                return ReminderType.Hours2;
            case 1440:
                return ReminderType.Days1;
            case 2880:
                return ReminderType.Days2;
            case 10080:
                return ReminderType.Weeks1;
            default:
                return ReminderType.Custom;
        }
    }

    /**
     * Get minutes from reminder type enum
     */
    private getMinutesFromReminderType(type: ReminderType): number {
        switch (type) {
            case ReminderType.Minutes15:
                return 15;
            case ReminderType.Minutes30:
                return 30;
            case ReminderType.Hours1:
                return 60;
            case ReminderType.Hours2:
                return 120;
            case ReminderType.Days1:
                return 1440;
            case ReminderType.Days2:
                return 2880;
            case ReminderType.Weeks1:
                return 10080;
            default:
                return 60; // Default to 1 hour
        }
    }

    /**
     * Process reminders asynchronously in the background
     */
    private async processRemindersAsync(taskId: string, userId?: string): Promise<void> {
        try {
            const task = await Task.findById(taskId);
            if (!task || !task.startTime || !userId) {
                return;
            }

            // Get default reminders from user settings
            const defaultReminders = task.settings?.notifications?.reminderSettings?.defaultReminders || [15, 60];
            
            if (defaultReminders.length > 0) {
                const reminders = await Promise.all(
                    defaultReminders.map(async (minutesBefore: number) => ({
                        type: this.getReminderTypeFromMinutes(minutesBefore),
                        amount: minutesBefore,
                        unit: ReminderUnit.Minutes,
                        triggered: false,
                        triggerTime: await this.calculateReminderTime(
                            task.startTime!,
                            minutesBefore,
                            userId
                        )
                    }))
                );

                // Update task with reminders
                await Task.findByIdAndUpdate(taskId, {
                    reminders: reminders,
                    $unset: { needsReminderProcessing: 1 }
                });
            }
        } catch (error) {
            console.error('Error processing reminders for task:', taskId, error);
        }
    }
}

export default new TaskService();