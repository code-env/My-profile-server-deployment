import express from 'express';
import {
    addParticipants,
    updateParticipantStatus,
    removeParticipant,
    getEventParticipants,
    updateParticipantRole
} from '../controllers/participant.controller';
import { protect } from '../middleware';
const router = express.Router();

// All routes are protected
router.use(protect);

// Event participant routes
router.post('/events/:eventId/participants', addParticipants);
router.get('/events/:eventId/participants', getEventParticipants);
router.patch('/events/:eventId/participants/:profileId/status', updateParticipantStatus);
router.patch('/events/:eventId/participants/:profileId/role', updateParticipantRole);
router.delete('/events/:eventId/participants/:profileId', removeParticipant);

export default router; 