import { Request, Response } from 'express';
import participantService from '../services/participant.service';
import createHttpError from 'http-errors';
import asyncHandler from 'express-async-handler';

/**
 * @desc    Add participants to an event
 * @route   POST /api/events/:eventId/participants
 * @access  Private
 */
export const addParticipants = asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;
    const { eventId } = req.params;
    const { profileIds, role } = req.body;

    if (!profileIds || !Array.isArray(profileIds) || profileIds.length === 0) {
        throw createHttpError(400, 'Please provide valid profile IDs');
    }

    const event = await participantService.addParticipants(eventId, user._id, profileIds, role);

    res.status(201).json({
        success: true,
        data: event,
        message: 'Participants added successfully'
    });
});

/**
 * @desc    Update participant status
 * @route   PATCH /api/events/:eventId/participants/:profileId/status
 * @access  Private
 */
export const updateParticipantStatus = asyncHandler(async (req: Request, res: Response) => {
    const { eventId, profileId } = req.params;
    const { status } = req.body;

    if (!status || !['pending', 'accepted', 'declined', 'maybe'].includes(status)) {
        throw createHttpError(400, 'Invalid status');
    }

    const event = await participantService.updateParticipantStatus(eventId, profileId, status);

    res.json({
        success: true,
        data: event,
        message: 'Participant status updated successfully'
    });
});

/**
 * @desc    Remove participant from event
 * @route   DELETE /api/events/:eventId/participants/:profileId
 * @access  Private
 */
export const removeParticipant = asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;
    const { eventId, profileId } = req.params;

    const event = await participantService.removeParticipant(eventId, user._id, profileId);

    res.json({
        success: true,
        data: event,
        message: 'Participant removed successfully'
    });
});

/**
 * @desc    Get all participants for an event
 * @route   GET /api/events/:eventId/participants
 * @access  Private
 */
export const getEventParticipants = asyncHandler(async (req: Request, res: Response) => {
    const { eventId } = req.params;
    const { status, role } = req.query;

    const participants = await participantService.getEventParticipants(eventId, {
        status: status as any,
        role: role as any
    });

    res.json({
        success: true,
        data: participants,
        message: 'Participants fetched successfully'
    });
});

/**
 * @desc    Update participant role
 * @route   PATCH /api/events/:eventId/participants/:profileId/role
 * @access  Private
 */
export const updateParticipantRole = asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;
    const { eventId, profileId } = req.params;
    const { role } = req.body;

    if (!role || !['attendee', 'organizer', 'speaker'].includes(role)) {
        throw createHttpError(400, 'Invalid role');
    }

    const event = await participantService.updateParticipantRole(eventId, user._id, profileId, role);

    res.json({
        success: true,
        data: event,
        message: 'Participant role updated successfully'
    });
}); 