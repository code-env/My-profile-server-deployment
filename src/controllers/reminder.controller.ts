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
    const { itemType, itemId, itemIndex } = req.params;
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

    const result = await reminderService.addReminder(
        itemId,
        itemType as any,
        type,
        amount,
        unit,
        user._id
    );

    res.status(201).json({
        success: true,
        data: result,
        message: 'Reminder added successfully'
    });
});

/**
 * @desc    Cancel all reminders for an event
 * @route   POST /api/events/:eventId/reminders/cancel
 * @access  Private
 */
export const cancelAllReminders = asyncHandler(async (req: Request, res: Response) => {
    const { itemType, itemId } = req.params;
    const result = await reminderService.cancelAllReminders(itemId, itemType as any);
    res.json({ success: true, data: result, message: 'All reminders cancelled successfully' });
});

/**
 * @desc    Get all reminders for an event
 * @route   GET /api/events/:eventId/reminders
 * @access  Private
 */
export const getReminders = asyncHandler(async (req: Request, res: Response) => {
    const { itemType, itemId } = req.params;
    const reminders = await reminderService.getReminders(itemId, itemType as any);
    res.json({ success: true, data: reminders });
});

/**
 * @desc    Delete a reminder
 * @route   DELETE /api/events/:eventId/reminders/:reminderId
 * @access  Private
 */
export const deleteReminder = asyncHandler(async (req: Request, res: Response) => {
    const { itemType, itemId, reminderId } = req.params;
    await reminderService.deleteReminder(itemId, reminderId, itemType as any);
    res.json({ success: true, message: 'Reminder deleted successfully' });
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

export const getAllReminders = asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;
    const reminders = await reminderService.getAllRemindersForUser(user._id);
    res.json({ success: true, data: reminders });
}); 