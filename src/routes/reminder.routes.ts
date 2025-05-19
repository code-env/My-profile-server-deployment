import express from 'express';
import {
    addReminder,
    getReminders,
    deleteReminder,
    processDueReminders,
    cancelAllReminders
} from '../controllers/reminder.controller';
import { protect } from '../middleware';

const router = express.Router();

// All routes are protected
router.use(protect);

// Unified reminder routes
router.post('/:itemType/:itemId', addReminder);
router.get('/:itemType/:itemId/', getReminders);
router.delete('/:itemType/:itemId/:reminderId', deleteReminder);
router.post('/:itemType/:itemId/cancel', cancelAllReminders);

// For list items (with itemIndex)
router.post('/list/:itemId/items/:itemIndex/reminders', addReminder);

// Internal reminder processing route
router.post('/process', processDueReminders);

// (Optional) Keep backward compatibility for event routes
// router.post('/:eventId/reminders', addReminder);
// router.get('/:eventId/reminders', getEventReminders);
// router.delete('/:eventId/reminders/:reminderId', deleteReminder);
// router.post('/:eventId/reminders/cancel', cancelAllReminders);

export default router; 