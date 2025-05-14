import express from 'express';
import {
    addReminder,
    getEventReminders,
    deleteReminder,
    processDueReminders,
    cancelAllReminders
} from '../controllers/reminder.controller';
import { protect } from '../middleware';

const router = express.Router();

// All routes are protected
router.use(protect);

// Event reminder routes
router.post('/:eventId/reminders', addReminder);
router.get('/:eventId/reminders', getEventReminders);
router.delete('/:eventId/reminders/:reminderId', deleteReminder);
router.post('/:eventId/reminders/cancel', cancelAllReminders);

// Internal reminder processing route
router.post('/process', processDueReminders);

export default router; 