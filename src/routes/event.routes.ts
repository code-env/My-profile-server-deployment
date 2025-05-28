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
    getProviderBookings,
    createCelebration,
    addGift,
    markGiftReceived,
    addSocialMediaPost,
    updateCelebrationStatus,
    updateEventStatus,
    bulkUpdateEventStatus
} from '../controllers/event.controller';

const router = express.Router();

// Event CRUD routes
router.post('/', createEvent);
router.get('/:id', getEventById);
router.get('/user/:userId', getUserEvents);
router.put('/:id', updateEvent);
router.delete('/:id', deleteEvent);

// Comment routes
router.post('/:id/comments', addComment);
router.post('/:id/comments/:commentIndex/like', likeComment);

// Event interaction routes
router.post('/:id/agenda', addAgendaItem);
router.put('/:id/agenda/:itemId', updateAgendaItem);
router.delete('/:id/agenda/:itemId', deleteAgendaItem);
router.post('/:id/attachment', addAttachment);
router.delete('/:id/attachment/:attachmentId', removeAttachment);
router.post('/:id/like', likeEvent);

// Event status routes
router.patch('/:id/status', updateEventStatus);
router.patch('/bulk/status', bulkUpdateEventStatus);

// Booking routes
router.post('/booking', createBooking);
router.patch('/:id/booking/status', updateBookingStatus);
router.patch('/:id/booking/reward', updateBookingReward);
router.patch('/:id/booking/reschedule', rescheduleBooking);
router.get('/bookings/provider/:profileId', getProviderBookings);

// Celebration routes
router.post('/celebration', createCelebration);
router.post('/:id/celebration/gift', addGift);
router.patch('/:id/celebration/gift/:giftIndex', markGiftReceived);
router.post('/:id/celebration/social', addSocialMediaPost);
router.patch('/:id/celebration/status', updateCelebrationStatus);

export default router;