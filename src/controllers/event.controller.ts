import { Request, Response } from 'express';
import mongoose from 'mongoose';
import eventService from '../services/event.service';
import {
    PriorityLevel,
    RepeatFrequency,
    EndCondition,
    ReminderType,
    ReminderUnit,
    VisibilityType,
    Attachment
} from '../models/plans-shared';
import createHttpError from 'http-errors';
import asyncHandler from 'express-async-handler';
import CloudinaryService from '../services/cloudinary.service';

// Helper function to validate event data
const validateEventData = (data: any) => {
    const errors: string[] = [];

    if (!data.title) errors.push('title is required');
    if (!data.startTime) errors.push('startTime is required');
    if (!data.endTime) errors.push('endTime is required');
    if (!data.eventType) errors.push('eventType is required');

    // Validate enums
    if (data.priority && !Object.values(PriorityLevel).includes(data.priority)) {
        errors.push(`priority must be one of: ${Object.values(PriorityLevel).join(', ')}`);
    }
    if (data.visibility && !Object.values(VisibilityType).includes(data.visibility)) {
        errors.push(`visibility must be one of: ${Object.values(VisibilityType).join(', ')}`);
    }
    if (data.eventType && !['meeting', 'celebration', 'appointment'].includes(data.eventType)) {
        errors.push(`eventType must be one of: meeting, celebration, appointment`);
    }

    // Validate meeting-specific requirements
    if (data.eventType === 'appointment' && !data.serviceProvider) {
        errors.push('serviceProvider is required for meetings');
    }

    // Validate repeat settings if provided
    if (data.repeat) {
        if (data.repeat.frequency && !Object.values(RepeatFrequency).includes(data.repeat.frequency)) {
            errors.push(`repeat.frequency must be one of: ${Object.values(RepeatFrequency).join(', ')}`);
        }
        if (data.repeat.endCondition && !Object.values(EndCondition).includes(data.repeat.endCondition)) {
            errors.push(`repeat.endCondition must be one of: ${Object.values(EndCondition).join(', ')}`);
        }
    }

    // Validate reminders if provided
    if (data.reminders && Array.isArray(data.reminders)) {
        data.reminders.forEach((reminder: any, index: number) => {
            if (reminder.type && !Object.values(ReminderType).includes(reminder.type)) {
                errors.push(`reminders[${index}].type must be one of: ${Object.values(ReminderType).join(', ')}`);
            }
            if (reminder.unit && !Object.values(ReminderUnit).includes(reminder.unit)) {
                errors.push(`reminders[${index}].unit must be one of: ${Object.values(ReminderUnit).join(', ')}`);
            }
        });
    }

    if (errors.length > 0) {
        throw createHttpError(400, errors.join('; '));
    }
};

// @desc    Create a new event
// @route   POST /events
// @access  Private
export const createEvent = asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;
    validateEventData(req.body);

    let uploadedFiles: Attachment[] = [];

    if (req.body.attachments && Array.isArray(req.body.attachments)) {
        const cloudinaryService = new CloudinaryService();

        uploadedFiles = await Promise.all(
            req.body.attachments.map(async (attachment: { data: string; type: string }) => {
                try {
                    const { data: base64String, type } = attachment;

                    if (typeof base64String !== 'string' || !base64String.startsWith('data:')) {
                        throw new Error('Invalid base64 data format');
                    }

                    if (!['Photo', 'File', 'Link', 'Other'].includes(type)) {
                        throw new Error(`Invalid attachment type: ${type}`);
                    }

                    let resourceType: 'image' | 'raw' = 'image';
                    if (type === 'File') {
                        resourceType = 'raw';
                    }

                    const fileTypeMatch = base64String.match(/^data:(image\/\w+|application\/\w+);base64,/);
                    const extension = fileTypeMatch ?
                        fileTypeMatch[1].split('/')[1] :
                        'dat';

                    const uploadResult = await cloudinaryService.uploadAndReturnAllInfo(
                        base64String,
                        {
                            folder: 'event-attachments',
                            resourceType,
                            tags: [`type-${type.toLowerCase()}`]
                        }
                    );

                    return {
                        type: type as 'Photo' | 'File' | 'Link' | 'Other',
                        url: uploadResult.secure_url,
                        name: uploadResult.original_filename || `attachment-${Date.now()}.${extension}`,
                        description: '',
                        uploadedAt: new Date(),
                        uploadedBy: user._id,
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

    const eventData = {
        ...req.body,
        attachments: uploadedFiles,
        createdBy: user._id,
        startTime: new Date(req.body.startTime),
        endTime: new Date(req.body.endTime)
    };

    const event = await eventService.createEvent(eventData);
    res.status(201).json({
        success: true,
        data: event,
        message: 'Event created successfully',
    });
});

// @desc    Get event by ID
// @route   GET /events/:id
// @access  Private
export const getEventById = asyncHandler(async (req: Request, res: Response) => {
    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw createHttpError(400, 'Invalid event ID');
    }

    const event = await eventService.getEventById(req.params.id);
    if (!event) {
        throw createHttpError(404, 'Event not found');
    }

    res.json({
        success: true,
        data: event,
        message: 'Event fetched successfully'
    });
});

// @desc    Get all events for user
// @route   GET /events
// @access  Private
export const getUserEvents = asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;
    const filters: any = {};

    // Apply filters from query params
    if (req.query.status) filters.status = req.query.status;
    if (req.query.priority) filters.priority = req.query.priority;
    if (req.query.category) filters.category = req.query.category;
    if (req.query.eventType) filters.eventType = req.query.eventType;
    if (req.query.isAllDay) filters.isAllDay = req.query.isAllDay === 'true';
    if (req.query.isGroupEvent) filters.isGroupEvent = req.query.isGroupEvent === 'true';
    if (req.query.search) filters.search = req.query.search;

    // Date filters
    if (req.query.fromDate) {
        filters.fromDate = new Date(req.query.fromDate as string);
    }
    if (req.query.toDate) {
        filters.toDate = new Date(req.query.toDate as string);
    }

    const events = await eventService.getUserEvents(user._id, filters);
    res.json({
        success: true,
        data: events,
        message: 'Events fetched successfully'
    });
});

// @desc    Update an event
// @route   PUT /events/:id
// @access  Private
export const updateEvent = asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;

    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw createHttpError(400, 'Invalid event ID');
    }

    validateEventData(req.body);

    let uploadedFiles: Attachment[] = [];

    if (req.body.attachments && Array.isArray(req.body.attachments)) {
        const cloudinaryService = new CloudinaryService();

        uploadedFiles = await Promise.all(
            req.body.attachments.map(async (attachment: { data: string; type: string }) => {
                try {
                    const { data: base64String, type } = attachment;

                    if (typeof base64String !== 'string' || !base64String.startsWith('data:')) {
                        throw new Error('Invalid base64 data format');
                    }

                    if (!['Photo', 'File', 'Link', 'Other'].includes(type)) {
                        throw new Error(`Invalid attachment type: ${type}`);
                    }

                    let resourceType: 'image' | 'raw' = 'image';
                    if (type === 'File') {
                        resourceType = 'raw';
                    }

                    const uploadResult = await cloudinaryService.uploadAndReturnAllInfo(
                        base64String,
                        {
                            folder: 'event-attachments',
                            resourceType,
                            tags: [`type-${type.toLowerCase()}`]
                        }
                    );

                    return {
                        type: type as 'Photo' | 'File' | 'Link' | 'Other',
                        url: uploadResult.secure_url,
                        name: uploadResult.original_filename || `attachment-${Date.now()}`,
                        description: '',
                        uploadedAt: new Date(),
                        uploadedBy: user._id,
                        size: uploadResult.bytes,
                        fileType: uploadResult.format,
                        publicId: uploadResult.public_id
                    };
                } catch (error) {
                    console.error('Error processing attachment:', error);
                    throw new Error(`Failed to process attachment: ${error}`);
                }
            })
        );
    }

    const eventData = {
        ...req.body,
        attachments: uploadedFiles,
        startTime: req.body.startTime ? new Date(req.body.startTime) : undefined,
        endTime: req.body.endTime ? new Date(req.body.endTime) : undefined
    };

    const event = await eventService.updateEvent(req.params.id, user._id, eventData);
    res.json({
        success: true,
        data: event,
        message: 'Event updated successfully'
    });
});

// @desc    Delete an event
// @route   DELETE /events/:id
// @access  Private
export const deleteEvent = asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;

    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw createHttpError(400, 'Invalid event ID');
    }

    await eventService.deleteEvent(req.params.id, user._id);
    res.json({
        success: true,
        data: null,
        message: 'Event deleted successfully'
    });
});

// @desc    Add agenda item to event
// @route   POST /events/:id/agenda-items
// @access  Private
export const addAgendaItem = asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;

    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw createHttpError(400, 'Invalid event ID');
    }

    if (!req.body.description) {
        throw createHttpError(400, 'Agenda item description is required');
    }

    const agendaItemData = {
        description: req.body.description,
        assignedTo: req.body.assignedTo,
        completed: req.body.completed || false
    };

    const event = await eventService.addAgendaItem(
        req.params.id,
        user._id,
        agendaItemData
    );
    res.json({
        success: true,
        data: event,
        message: 'Agenda item added successfully'
    });
});

// @desc    Update agenda item
// @route   PUT /events/:id/agenda-items/:agendaItemIndex
// @access  Private
export const updateAgendaItem = asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;

    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw createHttpError(400, 'Invalid event ID');
    }

    if (!req.params.agendaItemIndex || isNaN(parseInt(req.params.agendaItemIndex))) {
        throw createHttpError(400, 'Invalid agenda item index');
    }

    const agendaItemIndex = parseInt(req.params.agendaItemIndex);
    const event = await eventService.updateAgendaItem(
        req.params.id,
        user._id,
        agendaItemIndex,
        req.body
    );

    res.json({
        success: true,
        data: event,
        message: 'Agenda item updated successfully'
    });
});

// @desc    Delete agenda item
// @route   DELETE /events/:id/agenda-items/:agendaItemIndex
// @access  Private
export const deleteAgendaItem = asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;

    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw createHttpError(400, 'Invalid event ID');
    }

    if (!req.params.agendaItemIndex || isNaN(parseInt(req.params.agendaItemIndex))) {
        throw createHttpError(400, 'Invalid agenda item index');
    }

    const agendaItemIndex = parseInt(req.params.agendaItemIndex);
    const event = await eventService.deleteAgendaItem(
        req.params.id,
        user._id,
        agendaItemIndex
    );

    res.json({
        success: true,
        data: event,
        message: 'Agenda item deleted successfully'
    });
});

// @desc    Add attachment to event
// @route   POST /events/:id/attachments
// @access  Private
export const addAttachment = asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;

    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw createHttpError(400, 'Invalid event ID');
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

    const event = await eventService.addAttachment(
        req.params.id,
        user._id,
        attachmentData
    );

    res.json({
        success: true,
        data: event,
        message: 'Attachment added successfully'
    });
});

// @desc    Remove attachment from event
// @route   DELETE /events/:id/attachments/:attachmentIndex
// @access  Private
export const removeAttachment = asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;

    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw createHttpError(400, 'Invalid event ID');
    }

    if (!req.params.attachmentIndex || isNaN(parseInt(req.params.attachmentIndex))) {
        throw createHttpError(400, 'Invalid attachment index');
    }

    const attachmentIndex = parseInt(req.params.attachmentIndex);
    const event = await eventService.removeAttachment(
        req.params.id,
        user._id,
        attachmentIndex
    );

    res.json({
        success: true,
        data: event,
        message: 'Attachment removed successfully'
    });
});

// @desc    Set service provider for event
// @route   PUT /events/:id/service-provider
// @access  Private
export const setServiceProvider = asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;

    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw createHttpError(400, 'Invalid event ID');
    }

    if (!req.body.profileId || !req.body.role) {
        throw createHttpError(400, 'profileId and role are required');
    }

    const event = await eventService.setServiceProvider(
        req.params.id,
        user._id,
        {
            profileId: new mongoose.Types.ObjectId(req.body.profileId),
            role: req.body.role
        }
    );

    res.json({
        success: true,
        data: event,
        message: 'Service provider set successfully'
    });
});