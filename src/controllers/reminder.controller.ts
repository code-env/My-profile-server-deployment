import { Request, Response } from 'express';
import reminderService from '../services/reminder.service';
import { ReminderType, ReminderUnit } from '../models/plans-shared';
import createHttpError from 'http-errors';
import asyncHandler from 'express-async-handler';

/**
 * @desc    Add a reminder to an event
 * @route   POST /api/events/:eventId/reminders
 * @access  Private
 */
export const addReminder = asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;
    const { eventId } = req.params;
    const { type, amount, unit, message, recipients } = req.body;

    // Validate reminder data
    if (!type || !Object.values(ReminderType).includes(type)) {
        throw createHttpError(400, 'Invalid reminder type');
    }
    if (!amount || typeof amount !== 'number' || amount <= 0) {
        throw createHttpError(400, 'Invalid reminder amount');
    }
    if (!unit || !Object.values(ReminderUnit).includes(unit)) {
        throw createHttpError(400, 'Invalid reminder unit');
    }

    const event = await reminderService.addReminder(eventId, user._id, {
        type,
        value: amount,
        unit,
        message,
        recipients
    });

    res.status(201).json({
        success: true,
        data: event,
        message: 'Reminder added successfully'
    });
});

/**
 * @desc    Cancel all reminders for an event
 * @route   POST /api/events/:eventId/reminders/cancel
 * @access  Private
 */
export const cancelAllReminders = asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;
    const { eventId } = req.params;

    const event = await reminderService.cancelAllReminders(eventId);

    res.json({
        success: true,
        data: event,
        message: 'All reminders cancelled successfully'
    });
});

/**
 * @desc    Get all reminders for an event
 * @route   GET /api/events/:eventId/reminders
 * @access  Private
 */
export const getEventReminders = asyncHandler(async (req: Request, res: Response) => {
    const { eventId } = req.params;
    const reminders = await reminderService.getReminders(eventId, 'event');
    res.json({
        success: true,
        data: reminders
    });
});

/**
 * @desc    Delete a reminder
 * @route   DELETE /api/events/:eventId/reminders/:reminderId
 * @access  Private
 */
export const deleteReminder = asyncHandler(async (req: Request, res: Response) => {
    const { eventId, reminderId } = req.params;
    await reminderService.deleteReminder(eventId, reminderId);
    res.json({
        success: true,
        message: 'Reminder deleted successfully'
    });
});

/**
 * @desc    Process due reminders (internal endpoint)
 * @route   POST /api/reminders/process
 * @access  Private
 */
export const processDueReminders = asyncHandler(async (req: Request, res: Response) => {
    await reminderService.processDueReminders();

    res.json({
        success: true,
        message: 'Due reminders processed successfully'
    });
}); 