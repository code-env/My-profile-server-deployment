import mongoose, { Types } from 'mongoose';
import { ISubTask, RepeatSettings, Reminder, Reward, Attachment, Comment, Location, PriorityLevel, TaskCategory } from '../models/plans-shared';
import { IUser, User } from '../models/User';
import { IProfile } from '../interfaces/profile.interface';
import { TaskStatus } from 'twilio/lib/rest/taskrouter/v1/workspace/task';
import { List } from '../models/List';
import { ITask, Task } from '../models/Tasks';
import { checkTimeOverlap } from '../utils/timeUtils';
import { SettingsService } from './settings.service';
import { taskSettingsIntegration } from '../utils/taskSettingsIntegration';
import { mapExternalToInternal } from '../utils/visibilityMapper';

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
        const result = await Task.deleteOne({ _id: taskId, createdBy: userId });
        if (result.deletedCount === 0) {
            throw new Error('Task not found or access denied');
        }
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
}

export default new TaskService();