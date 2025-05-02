import express from 'express';
import {
    createEvent,
    getEventById,
    getUserEvents,
    updateEvent,
    deleteEvent,
    addAgendaItem,
    updateAgendaItem,
    deleteAgendaItem,
    addAttachment,
    removeAttachment,
    setServiceProvider
} from '../controllers/event.controller';

const router = express.Router();

// Event CRUD routes
router.post('/', createEvent);
router.get('/', getUserEvents);
router.get('/:id', getEventById);
router.put('/:id', updateEvent);
router.delete('/:id', deleteEvent);

// Agenda Item routes
router.post('/:id/agenda-items', addAgendaItem);
router.put('/:id/agenda-items/:agendaItemIndex', updateAgendaItem);
router.delete('/:id/agenda-items/:agendaItemIndex', deleteAgendaItem);

// Attachment routes
router.post('/:id/attachments', addAttachment);
router.delete('/:id/attachments/:attachmentIndex', removeAttachment);

// Service Provider routes
router.put('/:id/service-provider', setServiceProvider);

export default router;