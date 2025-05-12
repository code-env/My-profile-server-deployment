import { Request, Response } from 'express';
import mongoose, { Types } from 'mongoose';
import taskService from '../services/task.service';
import { ITask } from '../models/Tasks';
import {
    TaskStatus,
    TaskType
} from '../models/plans-shared';
import createHttpError from 'http-errors';
import asyncHandler from 'express-async-handler';
import CloudinaryService from '../services/cloudinary.service';
import { request } from 'http';
import { InteractionService } from '../services/interaction.service';
import { Interaction } from '../models/Interaction';
import { Attachment, EndCondition, PriorityLevel, ReminderType, ReminderUnit, RepeatFrequency, TaskCategory, VisibilityType } from '../models/plans-shared';
import Client from 'socket.io-client';
import { emitSocialInteraction } from '../utils/socketEmitter';

// Helper function to validate task data
const validateTaskData = (data: any) => {
    const errors: string[] = [];

    if (!data.name) errors.push('name is required');

    // Validate enums
    if (data.priority && !Object.keys(PriorityLevel).includes(data.priority)) {
        errors.push(`priority must be one of: ${Object.keys(PriorityLevel).join(', ')}`);
    }
    if (data.category && !Object.keys(TaskCategory).includes(data.category)) {
        errors.push(`category must be one of: ${Object.keys(TaskCategory).join(', ')}`);
    }
    if (data.status && !Object.keys(TaskStatus).includes(data.status)) {
        errors.push(`status must be one of: ${Object.keys(TaskStatus).join(', ')}`);
    }
    if (data.visibility && !Object.keys(VisibilityType).includes(data.visibility)) {
        errors.push(`visibility must be one of: ${Object.keys(VisibilityType).join(', ')}`);
    }

    if (!data.profile) {
        errors.push('profileId is required');
    }



    // Validate repeat settings if provided
    if (data.repeat) {
        if (data.repeat.frequency && !Object.keys(RepeatFrequency).includes(data.repeat.frequency)) {
            errors.push(`repeat.frequency must be one of: ${Object.keys(RepeatFrequency).join(', ')}`);
        }
        if (data.repeat.endCondition && !Object.keys(EndCondition).includes(data.repeat.endCondition)) {
            errors.push(`repeat.endCondition must be one of: ${Object.keys(EndCondition).join(', ')}`);
        }
    }

    // Validate reminders if provided
    if (data.reminders && Array.isArray(data.reminders)) {
        data.reminders.forEach((reminder: any, index: number) => {
            if (reminder.type && !Object.keys(ReminderType).includes(reminder.type)) {
                errors.push(`reminders[${index}].type must be one of: ${Object.keys(ReminderType).join(', ')}`);
            }
            if (reminder.unit && !Object.keys(ReminderUnit).includes(reminder.unit)) {
                errors.push(`reminders[${index}].unit must be one of: ${Object.keys(ReminderUnit).join(', ')}`);
            }
        });
    }

    if (data.type && !Object.keys(TaskType).includes(data.type)) {
        errors.push(`type must be one of: ${Object.keys(TaskType).join(', ')}`);
    }

    if (errors.length > 0) {
        throw createHttpError(400, errors.join('; '));
    }
};

// @desc    Create a new task
// @route   POST /tasks
// @access  Private
export const createTask = asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;

    console.log('User ID:', user._id);
    validateTaskData(req.body);

    let uploadedFiles: Attachment[] = [];

    if (req.body.attachments && Array.isArray(req.body.attachments)) {
        const cloudinaryService = new CloudinaryService();

        // Process each attachment object
        uploadedFiles = await Promise.all(
            req.body.attachments.map(async (attachment: { data: string; type: string }) => {
                try {
                    const { data: base64String, type } = attachment;

                    // Validate inputs
                    if (typeof base64String !== 'string' || !base64String.startsWith('data:')) {
                        throw new Error('Invalid base64 data format');
                    }

                    if (!['Photo', 'File', 'Link', 'Other'].includes(type)) {
                        throw new Error(`Invalid attachment type: ${type}`);
                    }

                    // Determine Cloudinary resource type based on attachment type
                    let resourceType: 'image' | 'raw' = 'image';
                    if (type === 'File') {
                        resourceType = 'raw';
                    }

                    // Extract file extension from base64 string
                    const fileTypeMatch = base64String.match(/^data:(image\/\w+|application\/\w+);base64,/);
                    const extension = fileTypeMatch ?
                        fileTypeMatch[1].split('/')[1] :
                        'dat';

                    // Upload to Cloudinary
                    const uploadResult = await cloudinaryService.uploadAndReturnAllInfo(
                        base64String,
                        {
                            folder: 'task-attachments',
                            resourceType,
                            tags: [`type-${type.toLowerCase()}`]
                        }
                    );

                    // Create proper Attachment object
                    return {
                        type: type as 'Photo' | 'File' | 'Link' | 'Other',
                        url: uploadResult.secure_url,
                        name: uploadResult.original_filename || `attachment-${Date.now()}.${extension}`,
                        description: '',
                        uploadedAt: new Date(),
                        uploadedBy: user._id, // This should already be an ObjectId
                        size: uploadResult.bytes,
                        fileType: uploadResult.format || extension,
                        publicId: uploadResult.public_id
                    };
                } catch (error) {
                    console.error('Error processing attachment:', error);
                    throw new Error(`Failed to process attachment: ${error}`);
                }
            })
        );
    }

    // Create the task data object
    const taskData = {
        ...req.body,
        attachments: uploadedFiles,
        createdBy: user._id,
        name: req.body.name,
    };

    // Remove any undefined values that might cause validation issues
    Object.keys(taskData).forEach(key => taskData[key] === undefined && delete taskData[key]);

    console.log('Final task data being sent to service:', JSON.stringify(taskData, null, 2));

    const task = await taskService.createTask(taskData); // Pass just the taskData
    res.status(201).json({
        success: true,
        data: task,
        message: 'Task created successfully',
    });
});

// @desc    Get task by ID
// @route   GET /tasks/:id
// @access  Private
export const getTaskById = asyncHandler(async (req: Request, res: Response) => {
    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw createHttpError(400, 'Invalid task ID');
    }

    const task = await taskService.getTaskById(req.params.id);
    if (!task) {
        throw createHttpError(404, 'Task not found');
    }

    if (!task.profile) {
        throw createHttpError(400, 'Task has no associated profile');
    }


    res.json({
        success: true,
        data: task,
        message: 'Task fetched successfully'
    });
});

// @desc    Get all tasks for user
// @route   GET /tasks
// @access  Private
export const getUserTasks = asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;
    const filters: any = {};

    // Apply filters from query params
    if (req.query.status) filters.status = req.query.status;
    if (req.query.priority) filters.priority = req.query.priority;
    if (req.query.category) filters.category = req.query.category;
    if (req.query.isAllDay) filters.isAllDay = req.query.isAllDay === 'true';
    if (req.query.profile) filters.profile = req.query.profile;
    if (req.query.search) filters.search = req.query.search;

    // Date filters
    if (req.query.fromDate) {
        filters.fromDate = new Date(req.query.fromDate as string);
    }
    if (req.query.toDate) {
        filters.toDate = new Date(req.query.toDate as string);
    }

    const tasks = await taskService.getUserTasks(user._id, filters);
    res.json({
        success: true,
        data: tasks,
        message: 'Tasks fetched successfully'
    });
});

// @desc    Update a task
// @route   PUT /tasks/:id
// @access  Private
export const updateTask = asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;

    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw createHttpError(400, 'Invalid task ID');
    }

    validateTaskData(req.body);

    // check for attachement
    let uploadedFiles: Attachment[] = [];

    if (req.body.attachments && Array.isArray(req.body.attachments)) {
        const cloudinaryService = new CloudinaryService();

        // Process each attachment object
        uploadedFiles = await Promise.all(
            req.body.attachments.map(async (attachment: { data: string; type: string }) => {
                try {
                    const { data: base64String, type } = attachment;

                    // Validate inputs
                    if (typeof base64String !== 'string' || !base64String.startsWith('data:')) {
                        console.log(typeof base64String, base64String.startsWith('data:'));
                        throw new Error('Invalid base64 data format');
                    }

                    if (!['Photo', 'File', 'Link', 'Other'].includes(type)) {
                        throw new Error(`Invalid attachment type: ${type}`);
                    }

                    // Determine Cloudinary resource type based on attachment type
                    let resourceType: 'image' | 'raw' = 'image';
                    if (type === 'File') {
                        resourceType = 'raw';
                    }

                    // Extract file extension from base64 string
                    const fileTypeMatch = base64String.match(/^data:(image\/\w+|application\/\w+);base64,/);
                    const extension = fileTypeMatch ?
                        fileTypeMatch[1].split('/')[1] :
                        'dat';

                    // Upload to Cloudinary
                    const uploadResult = await cloudinaryService.uploadAndReturnAllInfo(
                        base64String,
                        {
                            folder: 'task-attachments',
                            resourceType,
                            tags: [`type-${type.toLowerCase()}`]
                        }
                    );

                    // Create proper Attachment object
                    return {
                        type: type as 'Photo' | 'File' | 'Link' | 'Other',
                        url: uploadResult.secure_url,
                        name: uploadResult.original_filename || `attachment-${Date.now()}.${extension}`,
                        description: '',
                        uploadedAt: new Date(),
                        uploadedBy: user._id, // This should already be an ObjectId
                        size: uploadResult.bytes,
                        fileType: uploadResult.format || extension,
                        publicId: uploadResult.public_id
                    };
                } catch (error) {
                    console.error('Error processing attachment:', error);
                    throw new Error(`Failed to process attachment: ${error}`);
                }
            })
        );

    }

    const taskData = {
        ...req.body,
        attachments: uploadedFiles,
        updatedBy: user._id,
    };

    const task = await taskService.updateTask(req.params.id, user._id, taskData);
    res.json({
        success: true,
        data: task,
        message: 'Task updated successfully'
    });
});

// @desc    Delete a task
// @route   DELETE /tasks/:id
// @access  Private
export const deleteTask = asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;

    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw createHttpError(400, 'Invalid task ID');
    }

    await taskService.deleteTask(req.params.id, user._id);
    res.json({
        success: true,
        data: null,
        message: 'Task deleted successfully'
    });
});

// @desc    Add subtask to task
// @route   POST /tasks/:id/subtasks
// @access  Private
export const addSubTask = asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;

    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw createHttpError(400, 'Invalid task ID');
    }

    if (!req.body.description) {
        throw createHttpError(400, 'Subtask description is required');
    }

    const subTaskData = {
        description: req.body.description,
        isCompleted: req.body.isCompleted || false,
    };

    const task = await taskService.addSubTask(req.params.id, user._id, subTaskData);
    res.json({
        success: true,
        data: task,
        message: 'Subtask added successfully'
    });
});

// @desc    Update subtask
// @route   PUT /tasks/:id/subtasks/:subTaskIndex
// @access  Private
export const updateSubTask = asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;

    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw createHttpError(400, 'Invalid task ID');
    }

    if (!req.params.subTaskIndex || isNaN(parseInt(req.params.subTaskIndex))) {
        throw createHttpError(400, 'Invalid subtask index');
    }

    const subTaskIndex = parseInt(req.params.subTaskIndex);
    const task = await taskService.updateSubTask(
        req.params.id,
        user._id,
        subTaskIndex,
        req.body
    );

    res.json({
        success: true,
        data: task,
        message: 'Subtask updated successfully'
    });
});

// @desc    Delete subtask
// @route   DELETE /tasks/:id/subtasks/:subTaskIndex
// @access  Private
export const deleteSubTask = asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;

    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw createHttpError(400, 'Invalid task ID');
    }

    if (!req.params.subTaskIndex || isNaN(parseInt(req.params.subTaskIndex))) {
        throw createHttpError(400, 'Invalid subtask index');
    }

    const subTaskIndex = parseInt(req.params.subTaskIndex);
    const task = await taskService.deleteSubTask(
        req.params.id,
        user._id,
        subTaskIndex
    );

    res.json({
        success: true,
        data: task,
        message: 'Subtask deleted successfully'
    });
});

// @desc    Add comment to task
// @route   POST /tasks/:id/comments
// @access  Private
export const addComment = asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;

    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw createHttpError(400, 'Invalid task ID');
    }

    if (!req.body.text) {
        throw createHttpError(400, 'Comment text is required');
    }

    const task = await taskService.getTaskById(req.params.id);
    if (!task) {
        throw createHttpError(404, 'Task not found');
    }

    console.log('takeProfileId', task);

    if (!task.profile) {
        throw createHttpError(400, 'Task has no associated profile');
    }

    // Type assertions for IDs
    const targetProfileId = (task.profile as any)._id.toString();
    const profileId = (task.profile as any)._id.toString();

    const updatedTask = await taskService.addComment(
        req.params.id,
        user._id,
        profileId,
        req.body.text
    );

    try {
        await emitSocialInteraction(user._id, {
            type: 'comment',
            profile: new Types.ObjectId(user._id),
            targetProfile: new Types.ObjectId(task.profile?._id as Types.ObjectId),
            contentId: (updatedTask as mongoose.Document).get('_id').toString(),
            content: req.body.text
        });
    } catch (error) {
        console.error('Failed to emit social interaction:', error);
    }

    try {
        await emitSocialInteraction(user._id, {
            type: 'like',
            profile: new Types.ObjectId(user._id),
            targetProfile: new Types.ObjectId(task.profile?._id as Types.ObjectId),
            contentId: (updatedTask as mongoose.Document).get('_id').toString(),
            content: ''
        });
    } catch (error) {
        console.error('Failed to emit social interaction:', error);
    }

    res.json({
        success: true,
        data: updatedTask,
        message: 'Comment added successfully'
    });
});

// @desc    Like comment
// @route   POST /tasks/:id/comments/:commentIndex/like
// @access  Private
export const likeComment = asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;

    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw createHttpError(400, 'Invalid task ID');
    }

    if (!req.params.commentIndex || isNaN(parseInt(req.params.commentIndex))) {
        throw createHttpError(400, 'Invalid comment index');
    }



    const profileId = req.body.profileId;

    const commentIndex = parseInt(req.params.commentIndex);
    const task = await taskService.likeComment(
        req.params.id,
        commentIndex,
        user._id,
        profileId
    );

    // Emit the social interaction event
    try {
        await emitSocialInteraction(user._id, {
            type: 'like',
            profile: new Types.ObjectId(user._id),
            targetProfile: new Types.ObjectId(task.profile?._id as Types.ObjectId),
            contentId: (task as mongoose.Document).get('_id').toString(),
            content: ''
        });
    } catch (error) {
        console.error('Failed to emit social interaction:', error);
        // Don't throw the error as the like was still added successfully
    }

    res.json({
        success: true,
        data: task,
        message: 'Comment liked successfully'
    });
});

// @desc    Unlike comment
// @route   DELETE /tasks/:id/comments/:commentIndex/like
// @access  Private
export const unlikeComment = asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;

    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw createHttpError(400, 'Invalid task ID');
    }

    if (!req.params.commentIndex || isNaN(parseInt(req.params.commentIndex))) {
        throw createHttpError(400, 'Invalid comment index');
    }

    const commentIndex = parseInt(req.params.commentIndex);
    const task = await taskService.unlikeComment(
        req.params.id,
        commentIndex,
        user._id
    );

    res.json({
        success: true,
        data: task,
        message: 'Comment unliked successfully'
    });
});

// @desc    Add attachment to task
// @route   POST /tasks/:id/attachments
// @access  Private
export const addAttachment = asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;

    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw createHttpError(400, 'Invalid task ID');
    }

    if (!req.body.type || !req.body.url || !req.body.name) {
        throw createHttpError(400, 'Attachment type, url, and name are required');
    }

    const attachmentData = {
        type: req.body.type,
        url: req.body.url,
        name: req.body.name,
        description: req.body.description,
        size: req.body.size,
        fileType: req.body.fileType
    };

    const task = await taskService.addAttachment(
        req.params.id,
        user._id,
        attachmentData
    );

    res.json({
        success: true,
        data: task,
        message: 'Attachment added successfully'
    });
});

// @desc    Remove attachment from task
// @route   DELETE /tasks/:id/attachments/:attachmentIndex
// @access  Private
export const removeAttachment = asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;

    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw createHttpError(400, 'Invalid task ID');
    }

    if (!req.params.attachmentIndex || isNaN(parseInt(req.params.attachmentIndex))) {
        throw createHttpError(400, 'Invalid attachment index');
    }

    const attachmentIndex = parseInt(req.params.attachmentIndex);
    const task = await taskService.removeAttachment(
        req.params.id,
        user._id,
        attachmentIndex
    );

    res.json({
        success: true,
        data: task,
        message: 'Attachment removed successfully'
    });
});

export const likeTask = asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;

    const profileId = new Types.ObjectId(req.params.profileId);

    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw createHttpError(400, 'Invalid task ID');
    }

    const taskToLike = await taskService.getTaskById(req.params.id);

    if (!taskToLike) {
        throw createHttpError(404, 'Task not found');
    }


    if (!taskToLike.profile) {
        throw createHttpError(400, 'Task has no associated profile');
    }

    const targetProfileId = new Types.ObjectId(taskToLike.get('profile')._id);

    const task = await taskService.likeTask(req.params.id, profileId);

    if (!task) {
        throw createHttpError(404, 'Task not found');
    }

    // Emit the social interaction event
    try {
        await emitSocialInteraction(user._id, {
            type: 'like',
            profile: new Types.ObjectId(user._id),
            targetProfile: new Types.ObjectId(task.profile?._id as Types.ObjectId),
            contentId: (task as mongoose.Document).get('_id').toString(),
            content: ''
        });
    } catch (error) {
        console.error('Failed to emit social interaction:', error);
    }

    res.json({
        success: true,
        data: task,
        message: 'Task liked successfully'
    });
});
