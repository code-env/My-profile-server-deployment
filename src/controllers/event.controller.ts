import { Request, Response } from 'express';
import mongoose, { Types } from 'mongoose';
import eventService from '../services/event.service';
import { NotificationService } from '../services/notification.service';
import {
    PriorityLevel,
    RepeatFrequency,
    EndCondition,
    ReminderType,
    ReminderUnit,
    Attachment,
    EventType,
    BookingStatus,
    EventStatus
} from '../models/plans-shared';
import createHttpError from 'http-errors';
import asyncHandler from 'express-async-handler';
import { emitSocialInteraction } from '../utils/socketEmitter';
import { MyPtsModel } from '../models/my-pts.model';
import { TransactionType } from '../interfaces/my-pts.interface';
import { User } from '../models/User';
import { vaultService } from '../services/vault.service';
import { mapTaskEventDataToInternal, mapTaskEventDataToExternal } from '../utils/visibilityMapper';
import { ProfileModel } from '../models/profile.model';

const notificationService = new NotificationService();

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
    if (data.visibility && !['Public', 'Private', 'Hidden', 'Custom', 'ConnectionsOnly', 'OnlyMe'].includes(data.visibility)) {
        errors.push(`visibility must be one of: Public, Private, Hidden, Custom`);
    }
    if (data.eventType && !Object.values(EventType).includes(data.eventType)) {
        errors.push(`eventType must be one of: ${Object.values(EventType).join(', ')}`);
    }

    // Validate booking-specific requirements
    if (data.eventType === EventType.Booking) {
        if (!data.booking) {
            errors.push('booking details are required for booking events');
        } else {
            if (!data.booking.serviceProvider?.profileId) {
                errors.push('service provider profile ID is required for bookings');
            }
            if (!data.booking.service?.name) {
                errors.push('service name is required for bookings');
            }
            if (!data.booking.service?.duration) {
                errors.push('service duration is required for bookings');
            }
            if (data.booking.myPts?.required && !data.booking.myPts?.amount) {
                errors.push('MyPts amount is required when MyPts payment is required');
            }
        }
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

                    // Upload to vault
                    const uploadResult = await vaultService.uploadAndAddToVault(
                        user._id,
                        req.body.profileId,
                        base64String,
                        type === "Photo" ? "Media" : type === "File" ? "Documents" : "Other",
                        // let the sub category be either Photo, Video, or Audio
                        type === "Photo" ? "Photo" : type === "File" ? "Video" : "Audio",
                        {
                            eventId: req.body._id,
                            eventName: req.body.name,
                            attachmentType: type,
                            description: req.body.description
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

    const eventData = mapTaskEventDataToInternal({
        ...req.body,
        attachments: uploadedFiles,
        createdBy: user._id,
        startTime: new Date(req.body.startTime),
        endTime: new Date(req.body.endTime)
    });

    const event = await eventService.createEvent(eventData);

    if (event.booking?.serviceProvider?.profileId) {
        // Find the profile first, then get the user who owns it
        const profile = await ProfileModel.findById(event.booking.serviceProvider.profileId);
        if (profile && profile.profileInformation?.creator) {
            const profileUser = await User.findById(profile.profileInformation.creator);
            if (profileUser) {
                await notificationService.createNotification({
                    recipient: profileUser._id,
                    type: 'booking_request',
                    title: 'New Booking Request',
                    message: `${user.fullName} has requested to book your service: ${event.booking?.service?.name}`,
                    relatedTo: {
                        model: 'Event',
                        id: event._id
                    },
                    action: {
                        text: 'View Booking',
                        url: `/bookings/${event._id}`
                    },
                    priority: 'high',
                    isRead: false,
                    isArchived: false,
                    metadata: {
                        bookingId: event._id,
                        itemTitle: event.booking?.service?.name || 'Service Booking',
                        eventType: 'booking',
                        notificationType: 'request',
                        startTime: event.startTime,
                        endTime: event.endTime,
                        location: event.location,
                        duration: event.booking?.service?.duration,
                        description: event.description,
                        status: 'pending',
                        service: {
                            name: event.booking?.service?.name,
                            duration: event.booking?.service?.duration
                        },
                        provider: {
                            profileId: event.booking?.serviceProvider?.profileId,
                            role: event.booking?.serviceProvider?.role
                        },
                        requester: {
                            name: user.fullName,
                            id: user._id
                        }
                    }
                });

                // Emit social interaction for booking request
                try {
                    setImmediate(async () => {
                        await emitSocialInteraction(user._id, {
                            type: 'connection',
                            profile: new mongoose.Types.ObjectId(req.body.profileId || user.activeProfile),
                            targetProfile: new mongoose.Types.ObjectId(event.booking?.serviceProvider?.profileId),
                            contentId: event._id as mongoose.Types.ObjectId,
                            content: `booking request: ${event.booking?.service?.name || 'service'}`
                        });
                    });
                } catch (error) {
                    console.error('Failed to emit social interaction for booking request:', error);
                }
            }
        }
    }

    // Emit social interaction for event creation with participants
    if (event.participants && event.participants.length > 0) {
        try {
            setImmediate(async () => {
                for (const participant of event.participants) {
                    if (participant.profile && participant.profile.toString() !== (req.body.profileId || user.activeProfile).toString()) {
                        await emitSocialInteraction(user._id, {
                            type: 'connection',
                            profile: new mongoose.Types.ObjectId(req.body.profileId || user.activeProfile),
                            targetProfile: new mongoose.Types.ObjectId(participant.profile),
                            contentId: event._id as mongoose.Types.ObjectId,
                            content: `event invitation: ${event.name || 'event'}`
                        });
                    }
                }
            });
        } catch (error) {
            console.error('Failed to emit social interaction for event participants:', error);
        }
    }
    
    // Map the response back to external format
    const responseEvent = mapTaskEventDataToExternal(event);
    
    res.status(201).json({
        success: true,
        data: responseEvent,
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

    // Map the response back to external format
    const responseEvent = mapTaskEventDataToExternal(event);

    res.json({
        success: true,
        data: responseEvent,
        message: 'Event fetched successfully'
    });
});

// @desc    Get user events
// @route   GET /events
// @access  Private
export const getUserEvents = asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;
    const profileId = req.body.profileId || user.activeProfile || req.query.profileId;
    
    if (!profileId) {
        throw createHttpError(400, 'Profile ID is required');
    }

    // Extract pagination parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    // Validate pagination parameters
    if (page < 1) {
        throw createHttpError(400, 'Page must be greater than 0');
    }
    if (limit < 1 || limit > 100) {
        throw createHttpError(400, 'Limit must be between 1 and 100');
    }
    
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

    const result = await eventService.getUserEvents(user._id, profileId, filters, page, limit);
    
    // Map each event to external format
    const mappedEvents = result.events.map(event => mapTaskEventDataToExternal(event));
    
    res.json({
        success: true,
        data: mappedEvents,
        pagination: result.pagination,
        message: 'Events fetched successfully'
    });
});

// @desc    Update an event
// @route   PUT /events/:id
// @access  Private
export const updateEvent = asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;
    const profileId = req.body.profileId || user.activeProfile;
    
    if (!profileId) {
        throw createHttpError(400, 'Profile ID is required');
    }

    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw createHttpError(400, 'Invalid event ID');
    }

    validateEventData(req.body);

    let uploadedFiles: Attachment[] = [];

    if (req.body.attachments && Array.isArray(req.body.attachments)) {

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

                    const uploadResult = await vaultService.uploadAndAddToVault(
                        user._id,
                        profileId,
                        base64String,
                        type === "Photo" ? "Media" : type === "File" ? "Documents" : "Other",
                        // let the sub category be either Photo, Video, or Audio
                        type === "Photo" ? "Photo" : type === "File" ? "Video" : "Audio",
                        {
                            eventId: req.body._id,
                            eventName: req.body.name,
                            attachmentType: type,
                            description: req.body.description
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

    const eventData = mapTaskEventDataToInternal({
        ...req.body,
        attachments: uploadedFiles,
        startTime: req.body.startTime ? new Date(req.body.startTime) : undefined,
        endTime: req.body.endTime ? new Date(req.body.endTime) : undefined
    });

    const event = await eventService.updateEvent(req.params.id, user._id, profileId, eventData);
    
    // Map the response back to external format
    const responseEvent = mapTaskEventDataToExternal(event);
    
    res.json({
        success: true,
        data: responseEvent,
        message: 'Event updated successfully'
    });
});

// @desc    Delete an event
// @route   DELETE /events/:id
// @access  Private
export const deleteEvent = asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;
    const profileId = req.body.profileId || user.activeProfile || req.query.profileId;
    
    if (!profileId) {
        throw createHttpError(400, 'Profile ID is required');
    }

    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw createHttpError(400, 'Invalid event ID');
    }

    await eventService.deleteEvent(req.params.id, user._id, profileId);
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
    const profileId = req.body.profileId || user.activeProfile;
    
    if (!profileId) {
        throw createHttpError(400, 'Profile ID is required');
    }

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
        profileId,
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
    const profileId = req.body.profileId || user.activeProfile;
    
    if (!profileId) {
        throw createHttpError(400, 'Profile ID is required');
    }

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
        profileId,
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
        throw createHttpError(400, 'profile and role are required');
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

// @desc    Add comment to event
// @route   POST /events/:id/comments
// @access  Private
export const addComment = asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;

    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw createHttpError(400, 'Invalid event ID');
    }

    if (!req.body.text) {
        throw createHttpError(400, 'Comment text is required');
    }

    if (!req.body.profile && !req.query.profile && !req.body.profileId) {
        throw createHttpError(400, 'Profile is required');
    }

    const event = await eventService.getEventById(req.params.id);
    if (!event) {
        throw createHttpError(404, 'Event not found');
    }

    if (!event.profile) {
        throw createHttpError(400, 'Event has no associated profile');
    }

    const profile = req.body.profileId || req.query.profileId || user.activeProfile;
    const updatedEvent = await eventService.addComment(
        req.params.id,
        user._id,
        profile,
        { text: req.body.text }
    );

    // Emit social interaction
    try {
        setImmediate(async () => {
            await emitSocialInteraction(user._id, {
                type: 'comment',
                profile: new Types.ObjectId(profile),
                targetProfile: new Types.ObjectId(event.profile?._id as Types.ObjectId),
                contentId: (updatedEvent as mongoose.Document).get('_id').toString(),
                content: req.body.text
            });
        });
    } catch (error) {
        console.error('Failed to emit social interaction:', error);
    }

    res.json({
        success: true,
        data: updatedEvent.comments[updatedEvent.comments.length - 1],
        message: 'Comment added successfully'
    });
});

// @desc    Like event
// @route   POST /events/:id/like
// @access  Private
export const likeEvent = asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;

    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw createHttpError(400, 'Invalid event ID');
    }

    const eventToLike = await eventService.getEventById(req.params.id);
    if (!eventToLike) {
        throw createHttpError(404, 'Event not found');
    }

    if (!eventToLike.profile) {
        throw createHttpError(400, 'Event has no associated profile');
    }

    if (!req.body.profileId && !req.query.profileId && !req.body.profile && !req.query.profile) {
        throw createHttpError(400, 'Profile is required');
    }

    const profile = req.body.profileId || req.query.profileId || req.body.profile || req.query.profile;

    const event = await eventService.likeEvent(req.params.id, user._id, profile);

    // display the updated event
    try {
        setImmediate(async () => {
            await emitSocialInteraction(user._id, {
                type: 'like',
                profile: new Types.ObjectId(profile),
                targetProfile: new Types.ObjectId(event.profile?._id as Types.ObjectId),
                contentId: (event as mongoose.Document).get('_id').toString(),
                content: 'liked event'
            });
        });
    } catch (error) {
        console.error('Failed to emit social interaction:', error);
    }

    res.json({
        success: true,
        data: event.comments[event.likes.length - 1],
        message: 'Event liked successfully'
    });
});

// @desc    Like comment
// @route   POST /events/:id/comments/:commentId/like
// @access  Private
export const likeComment = async (req: Request, res: Response) => {
    try {
        const user: any = req.user!;
        if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'Invalid event ID' });
        }

        if (!req.params.commentIndex || isNaN(parseInt(req.params.commentIndex))) {
            return res.status(400).json({ error: 'Invalid comment index' });
        }

        if (!req.body.profileId) {
            return res.status(400).json({ error: 'Profile ID is required' });
        }

        const commentIndex = parseInt(req.params.commentIndex);
        const event = await eventService.likeComment(
            req.params.id,
            commentIndex,
            user._id,
            req.body.profileId
        );

        // Emit social interaction
        try {
            setImmediate(async () => {
            await emitSocialInteraction(user._id, {
                type: 'like',
                profile: new Types.ObjectId(req.body.profileId),
                targetProfile: new Types.ObjectId(event.profile?._id as Types.ObjectId),
                contentId: (event as mongoose.Document).get('_id').toString(),
                content: ''
                });
            });
        } catch (error) {
            console.error('Failed to emit social interaction:', error);
        }

        return res.json({
            success: true,
            data: event,
            message: 'Comment liked successfully'
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to like comment'
        });
    }
};

// @desc    Create a booking event
// @route   POST /events/booking
// @access  Private
export const createBooking = async (req: Request, res: Response) => {
    try {
        const user = req.user as { _id: string; fullName: string };
        if (!user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        // Validate event data
        try {
            validateEventData(req.body);
        } catch (error: any) {
            return res.status(400).json({ message: error.message });
        }

        // Create the event
        const event = await eventService.createEvent({
            ...req.body,
            createdBy: user._id
        });

        // Notify the service provider about the new booking request
        if (event.booking?.serviceProvider?.profileId) {
            // Find the profile first, then get the user who owns it
            const profile = await ProfileModel.findById(event.booking.serviceProvider.profileId);
            if (profile && profile.profileInformation?.creator) {
                const profileUser = await User.findById(profile.profileInformation.creator);
                if (profileUser) {
                    setImmediate(async () => {
                        await notificationService.createNotification({
                            recipient: profileUser._id,
                            type: 'booking_request',
                            title: 'New Booking Request',
                            message: `${user.fullName} has requested to book your service: ${event.booking?.service?.name}`,
                            relatedTo: {
                                model: 'Event',
                                id: event._id
                            },
                            action: {
                                text: 'View Booking',
                                url: `/bookings/${event._id}`
                            },
                            priority: 'high',
                            isRead: false,
                            isArchived: false,
                            metadata: {
                                bookingId: event._id,
                                itemTitle: event.booking?.service?.name || 'Service Booking',
                                eventType: 'booking',
                                notificationType: 'request',
                                startTime: event.startTime,
                                endTime: event.endTime,
                                location: event.location,
                                duration: event.booking?.service?.duration,
                                description: event.description,
                                status: 'pending',
                                service: {
                                    name: event.booking?.service?.name,
                                    duration: event.booking?.service?.duration
                                },
                                provider: {
                                    profileId: event.booking?.serviceProvider?.profileId,
                                    role: event.booking?.serviceProvider?.role
                                },
                                requester: {
                                    name: user.fullName,
                                    id: user._id
                                }
                            }
                        });
                    });
                }
            }
        }

        res.status(201).json(event);
    } catch (error) {
        console.error('Error creating booking:', error);
        res.status(500).json({ message: 'Error creating booking' });
    }
};

// @desc    Update booking status
// @route   PATCH /events/:id/booking/status
// @access  Private
export const updateBookingStatus = asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;

    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw createHttpError(400, 'Invalid event ID');
    }

    if (!req.body.status || !Object.values(BookingStatus).includes(req.body.status)) {
        throw createHttpError(400, 'Invalid booking status');
    }

    const event = await eventService.updateBookingStatus(
        req.params.id,
        user._id,
        req.body.profileId,
        req.body.status,
        req.body.cancellationReason
    );

    res.json({
        success: true,
        data: event,
        message: 'Booking status updated successfully'
    });
});

// @desc    Update booking MyPts status
// @route   PATCH /events/:id/booking/mypts
// @access  Private
export const updateBookingMyPts = asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;

    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw createHttpError(400, 'Invalid event ID');
    }

    if (!req.body.status || !['pending', 'completed', 'failed'].includes(req.body.status)) {
        throw createHttpError(400, 'Invalid MyPts status');
    }

    const event = await eventService.getEventById(req.params.id);
    if (!event) {
        throw createHttpError(404, 'Event not found');
    }

    if (!event.booking?.reward) {
        throw createHttpError(400, 'This booking does not require MyPts payment');
    }

    // Handle MyPts transaction
    if (req.body.status === 'completed') {
        const myPts = await MyPtsModel.findOrCreate(user._id);
        await myPts.deductMyPts(
            event.booking.reward.points,
            TransactionType.BOOKING_PAYMENT,
            `Payment for booking: ${event.title}`,
            { eventId: event._id },
            req.body.transactionId
        );
    }

    const updatedEvent = await eventService.updateBookingReward(
        req.params.id,
        user._id,
        req.body.profileId,
        {
            status: req.body.status,
            transactionId: req.body.transactionId
        }
    );

    res.json({
        success: true,
        data: updatedEvent,
        message: 'Booking MyPts status updated successfully'
    });
});

// @desc    Reschedule booking
// @route   PATCH /events/:id/booking/reschedule
// @access  Private
export const rescheduleBooking = asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;

    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw createHttpError(400, 'Invalid event ID');
    }

    if (!req.body.startTime || !req.body.endTime) {
        throw createHttpError(400, 'New start and end times are required');
    }

    const event = await eventService.rescheduleBooking(
        req.params.id,
        user._id,
        req.body.profileId,
        new Date(req.body.startTime),
        new Date(req.body.endTime)
    );

    res.json({
        success: true,
        data: event,
        message: 'Booking rescheduled successfully'
    });
});

// @desc    Get bookings for a service provider
// @route   GET /events/bookings/provider/:profileId
// @access  Private
export const getProviderBookings = asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;

    if (!req.params.profileId || !mongoose.Types.ObjectId.isValid(req.params.profileId)) {
        throw createHttpError(400, 'Invalid profile ID');
    }

    const filters = {
        ...req.query,
        status: req.query.status as BookingStatus | undefined,
        fromDate: req.query.fromDate ? new Date(req.query.fromDate as string) : undefined,
        toDate: req.query.toDate ? new Date(req.query.toDate as string) : undefined
    };

    const bookings = await eventService.getProviderBookings(
        new mongoose.Types.ObjectId(req.params.profileId),
        filters
    );

    res.json({
        success: true,
        data: bookings,
        message: 'Provider bookings fetched successfully'
    });
});

// @desc    Update booking reward
// @route   PATCH /events/:id/booking/reward
// @access  Private
export const updateBookingReward = asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;

    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw createHttpError(400, 'Invalid event ID');
    }

    if (!req.body.status || !['pending', 'completed', 'failed'].includes(req.body.status)) {
        throw createHttpError(400, 'Invalid reward status');
    }

    if (!req.body.profileId) {
        throw createHttpError(400, 'Profile ID is required');
    }

    const event = await eventService.updateBookingReward(
        req.params.id,
        user._id,
        req.body.profileId,
        {
            status: req.body.status,
            transactionId: req.body.transactionId
        }
    );

    res.json({
        success: true,
        data: event,
        message: 'Booking reward updated successfully'
    });
});

// @desc    Create a celebration event
// @route   POST /events/celebration
// @access  Private
export const createCelebration = asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;

    // Validate event data
    try {
        validateEventData(req.body);
    } catch (error: any) {
        throw createHttpError(400, error.message);
    }

    // Create the celebration event
    const event = await eventService.createCelebration(
        req.body,
        user._id,
        req.body.profileId
    );

    res.status(201).json({
        success: true,
        data: event,
        message: 'Celebration created successfully'
    });
});

// @desc    Add a gift to a celebration
// @route   POST /events/:id/celebration/gift
// @access  Private
export const addGift = asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;

    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw createHttpError(400, 'Invalid event ID');
    }

    if (!req.body.description) {
        throw createHttpError(400, 'Gift description is required');
    }

    const event = await eventService.addGift(req.params.id, {
        description: req.body.description,
        requestedBy: req.body.requestedBy,
        link: req.body.link
    });

    res.json({
        success: true,
        data: event,
        message: 'Gift added successfully'
    });
});

// @desc    Mark a gift as received
// @route   PATCH /events/:id/celebration/gift/:giftIndex
// @access  Private
export const markGiftReceived = asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;

    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw createHttpError(400, 'Invalid event ID');
    }

    const giftIndex = parseInt(req.params.giftIndex);
    if (isNaN(giftIndex)) {
        throw createHttpError(400, 'Invalid gift index');
    }

    const event = await eventService.markGiftReceived(req.params.id, giftIndex);

    res.json({
        success: true,
        data: event,
        message: 'Gift marked as received'
    });
});

// @desc    Add a social media post to a celebration
// @route   POST /events/:id/celebration/social
// @access  Private
export const addSocialMediaPost = asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;

    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw createHttpError(400, 'Invalid event ID');
    }

    if (!req.body.platform || !req.body.postId || !req.body.url) {
        throw createHttpError(400, 'Platform, post ID, and URL are required');
    }

    const event = await eventService.addSocialMediaPost(req.params.id, {
        platform: req.body.platform,
        postId: req.body.postId,
        url: req.body.url
    });

    res.json({
        success: true,
        data: event,
        message: 'Social media post added successfully'
    });
});

// @desc    Update celebration status
// @route   PATCH /events/:id/celebration/status
// @access  Private
export const updateCelebrationStatus = asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;

    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw createHttpError(400, 'Invalid event ID');
    }

    if (!req.body.status || !['planning', 'upcoming', 'completed', 'cancelled'].includes(req.body.status)) {
        throw createHttpError(400, 'Invalid celebration status');
    }

    const event = await eventService.updateCelebrationStatus(req.params.id, req.body.status);

    res.json({
        success: true,
        data: event,
        message: 'Celebration status updated successfully'
    });
});

// @desc    Update event status
// @route   PATCH /events/:id/status
// @access  Private
export const updateEventStatus = asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;

    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw createHttpError(400, 'Invalid event ID');
    }

    if (!req.body.status || !Object.values(EventStatus).includes(req.body.status)) {
        throw createHttpError(400, 'Invalid event status');
    }

    const event = await eventService.updateEventStatus(
        req.params.id,
        user._id,
        req.body.status,
        {
            reason: req.body.reason,
            updatedBy: user._id,
            notes: req.body.notes
        }
    );

    res.json({
        success: true,
        data: event,
        message: 'Event status updated successfully'
    });
});

// @desc    Bulk update event statuses
// @route   PATCH /events/bulk/status
// @access  Private
export const bulkUpdateEventStatus = asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;

    if (!Array.isArray(req.body.eventIds) || req.body.eventIds.length === 0) {
        throw createHttpError(400, 'Event IDs array is required');
    }

    if (!req.body.status || !Object.values(EventStatus).includes(req.body.status)) {
        throw createHttpError(400, 'Invalid event status');
    }

    const results = await eventService.bulkUpdateEventStatus(
        req.body.eventIds,
        user._id,
        req.body.status,
        {
            reason: req.body.reason,
            updatedBy: user._id,
            notes: req.body.notes
        }
    );

    res.json({
        success: true,
        data: results,
        message: `Updated ${results.success.length} events, ${results.failed.length} failed`
    });
});