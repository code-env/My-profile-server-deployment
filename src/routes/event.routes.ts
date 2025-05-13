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
    setServiceProvider,
    addComment,
    likeEvent,
    likeComment,
    createBooking,
    updateBookingStatus,
    updateBookingReward,
    rescheduleBooking,
    getProviderBookings
} from '../controllers/event.controller';

const router = express.Router();

// Event CRUD routes
router.post('/', createEvent);
router.get('/:id', getEventById);
router.get('/', getUserEvents);
router.put('/:id', updateEvent);
router.delete('/:id', deleteEvent);

// Agenda routes
router.post('/:id/agenda', addAgendaItem);
router.put('/:id/agenda/:agendaIndex', updateAgendaItem);
router.delete('/:id/agenda/:agendaIndex', deleteAgendaItem);

// Attachment routes
router.post('/:id/attachments', addAttachment);
router.delete('/:id/attachments/:attachmentIndex', removeAttachment);

// Service provider route
router.put('/:id/service-provider', setServiceProvider);

// Comment routes
router.post('/:id/comments', addComment);
router.post('/:id/comments/:commentId/like', likeComment);

// Like route
router.post('/:id/like', likeEvent);

// Booking routes
router.post('/booking', createBooking);
router.patch('/:id/booking/status', updateBookingStatus);
router.patch('/:id/booking/reward', updateBookingReward);
router.patch('/:id/booking/reschedule', rescheduleBooking);
router.get('/bookings/provider/:profileId', getProviderBookings);

export default router;