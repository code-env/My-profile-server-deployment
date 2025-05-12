import mongoose from 'mongoose';
import { ISubTask, RepeatSettings, Reminder, Reward, Attachment, Comment, Location, PriorityLevel, TaskCategory } from '../models/plans-shared';
import { IUser, User } from '../models/User';
import { IProfile } from '../interfaces/profile.interface';
import { TaskStatus } from 'twilio/lib/rest/taskrouter/v1/workspace/task';
import { List } from '../models/List';
import { ITask, Task } from '../models/Tasks';
import { Types } from 'mongoose';
import { checkTimeOverlap } from '../utils/timeUtils';

class TaskService {
    /**
     * Create a new task with all fields
     */
    async createTask(taskData: Partial<ITask>): Promise<ITask> {
        // Check for time overlap if the task has a time range
        if (taskData.startTime && taskData.endTime) {
            const overlapCheck = await checkTimeOverlap(
                taskData.createdBy?.toString() || '',
                taskData.profile?.toString() || '',
                {
                    startTime: taskData.startTime,
                    endTime: taskData.endTime,
                    isAllDay: taskData.isAllDay || false
                }
            );

            if (overlapCheck.overlaps) {
                throw new Error(`Time conflict with existing items: ${overlapCheck.conflictingItems.map(item => `${item.type}: ${item.title}`).join(', ')}`);
            }
        }

        const task = new Task({
            ...taskData,
            type: taskData.type || 'Todo',
            createdBy: taskData.createdBy || null,
            profile: taskData.profile|| null,
            subTasks: taskData.subTasks || [],
            isAllDay: taskData.isAllDay || false,
            repeat: taskData.repeat || {
                isRepeating: false,
                frequency: 'None',
                endCondition: 'Never'
            },
            reminders: taskData.reminders || [],
            visibility: taskData.visibility || 'Public',
            participants: taskData.participants || [],
            color: taskData.color || '#1DA1F2',
            category: taskData.category || 'Personal',
            priority: taskData.priority || 'Low',
            status: taskData.status || 'Upcoming',
            attachments: taskData.attachments || [],
            comments: taskData.comments || [],
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

        return task;
    }

    private async createListsFromSubtasks(task: ITask): Promise<void> {
        console.log(task);
        const listPromise = new List({
            name: task.name || 'New List',
            type: 'Todo',
            createdBy: task.createdBy,
            relatedTask: task._id,
            items: task.subTasks.map((subTask: ISubTask) => ({
                name: subTask.description || 'Complete subtask',
                isCompleted: subTask.isCompleted || false,
                createdAt: subTask.createdAt || new Date()
            })),
            // Copy relevant properties from the task
            visibility: task.visibility,
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
    async getTaskById(taskId: string): Promise<ITask | null> {
        if (!mongoose.Types.ObjectId.isValid(taskId)) {
            throw new Error('Invalid task ID');
        }

        return Task.findById(taskId)
            .populate('createdBy', 'fullName email')
            .populate('participants', 'profileInformation.username profileType')
            .populate('profile', 'profileInformation.username profileType')
            .populate('relatedList', 'name type items')
            .populate('attachments.uploadedBy', 'profileInformation.username profileType')
            .populate({
                path: 'comments',
                populate: [
                    { path: 'profile', select: 'profileInformation.username profileType' },
                    { path: 'likes', select: 'profileInformation.username profileType' }
                ]
            })
            .lean()
            .exec()
            .then(task => {
                if (!task) return null;
                return {
                    ...task,
                    likesCount: task.likes?.length || 0,
                    commentsCount: task.comments?.length || 0
                };
            });
    }

    /**
     * Get all tasks for a user with filters
     */
    async getUserTasks(
        userId: string,
        filters: {
            status?: TaskStatus;
            priority?: PriorityLevel;
            category?: TaskCategory;
            search?: string;
            isAllDay?: boolean;
            profile?: string;
            fromDate?: Date;
            toDate?: Date;
        } = {}
    ): Promise<ITask[]> {
        const query: any = { createdBy: userId };

        // Apply filters
        if (filters.status) query.status = filters.status;
        if (filters.priority) query.priority = filters.priority;
        if (filters.category) query.category = filters.category;
        if (filters.isAllDay !== undefined) query.isAllDay = filters.isAllDay;
        if (filters.profile) query.profile = filters.profile;

        // Date range filtering
        if (filters.fromDate || filters.toDate) {
            query.$and = [];
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
            query.$or = [
                { name: searchRegex },
                { description: searchRegex },
                { notes: searchRegex },
            ];
        }

        return Task.find(query)
            .sort({
                priority: -1,
                startTime: 1,
                createdAt: -1
            })
            .populate('createdBy', 'fullName email')
            .populate('participants', 'fullName email')
            .populate('profile', 'fullName avatar');
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

        return task;
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
        userId: string,
        profileId: string,
        text: string
    ): Promise<ITask> {
        const comment: Comment = {
            text,
            profile: new mongoose.Types.ObjectId(profileId),
            createdBy: new mongoose.Types.ObjectId(userId),
            createdAt: new Date(),
            likes: []
        };

        const task = await Task.findOneAndUpdate(
            { _id: taskId },
            { $push: { comments: comment } },
            { new: true }
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
        userId: string,
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
        const userIdObj = new mongoose.Types.ObjectId(userId);
        const profileIdObj = new mongoose.Types.ObjectId(profileId);

        // Check if already liked
        if (comment.likes.some(like => like.toString() === userIdObj.toString())) {
            throw new Error('Comment already liked by this user');
        }

        comment.likes.push(userIdObj as unknown as IProfile & mongoose.Types.ObjectId);
        await task.save();
        return task;
    }

    /**
     * Unlike a comment on a task
     */
    async unlikeComment(
        taskId: string,
        commentIndex: number,
        userId: string
    ): Promise<ITask> {
        const task = await Task.findOne({ _id: taskId });
        if (!task) {
            throw new Error('Task not found');
        }

        if (commentIndex < 0 || commentIndex >= task.comments.length) {
            throw new Error('Invalid comment index');
        }

        const comment = task.comments[commentIndex];
        const userIdObj = new mongoose.Types.ObjectId(userId);

        // Remove like
        comment.likes = comment.likes.filter(like => like.toString() !== userIdObj.toString()) as mongoose.Types.ObjectId[];
        await task.save();
        return task;
    }

    /**
     * Add an attachment to a task
     */
    async addAttachment(
        taskId: string,
        userId: string,
        attachmentData: Omit<Attachment, 'uploadedAt' | 'uploadedBy'>
    ): Promise<ITask> {
        const attachment: Attachment = {
            ...attachmentData,
            uploadedAt: new Date(),
            uploadedBy: new mongoose.Types.ObjectId(userId)
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
        userId: string,
        attachmentIndex: number
    ): Promise<ITask> {
        const task = await Task.findOne({ _id: taskId, createdBy: userId });
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

    async likeTask(taskId: string, userId: Types.ObjectId) {
        const task = await Task.findById(taskId);
        if (!task) {
            throw new Error('Task not found');
        }

        if (!task.likes) {
            task.likes = [];
        }

        if (!task.likes.includes(userId)) {
            task.likes.push(userId);
            await task.save();
        }

        return task;
    }

    async unlikeTask(taskId: string, userId: Types.ObjectId) {
        const task = await Task.findById(taskId);
        if (!task) {
            throw new Error('Task not found');
        }

        if (task.likes) {
            task.likes = task.likes.filter(id => !id.equals(userId));
            await task.save();
        }

        return task;
    }
}

export default new TaskService();