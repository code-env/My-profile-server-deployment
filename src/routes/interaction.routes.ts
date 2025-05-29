import { Router } from 'express';
import {
    getUserInteractions,
    getUserStats,
    getRecentInteractions,
    getInteractionFrequency,
    getInteractionsBetweenProfiles,
    createManualInteraction,
    getAllProfileInteractions,
    createPhysicalInteraction,
    createBulkPhysicalInteractions
} from '../controllers/interaction.controller';

const router = Router();

// @desc    Get user's interactions with pagination and filters
// @route   GET /interactions/profile/:profileId
// @access  Private
router.get('/profile/:profileId', getUserInteractions);

// @desc    Get interaction statistics
// @route   GET /interactions/profile/:profileId/stats
// @access  Private
router.get('/profile/:profileId/stats', getUserStats);

// @desc    Get recent interactions
// @route   GET /interactions/profile/:profileId/recent
// @access  Private
router.get('/profile/:profileId/recent', getRecentInteractions);

// @desc    Get interaction frequency with a specific profile
// @route   GET /interactions/profile/:profileId/frequency/:relationshipId
// @access  Private
router.get('/profile/:profileId/frequency/:relationshipId', getInteractionFrequency);

// @desc    Get all interactions for a profile
// @route   GET /interactions/profile/:profileId/all
// @access  Private
router.get('/profile/:profileId/all', getAllProfileInteractions);

// @desc    Create manual interaction
// @route   POST /interactions
// @access  Private
router.post('/', createManualInteraction);

// @desc    Create physical interaction (QR scan, NFC tap, etc.)
// @route   POST /interactions/physical
// @access  Private
router.post('/physical', createPhysicalInteraction);

// @desc    Bulk create physical interactions
// @route   POST /interactions/physical/bulk
// @access  Private
router.post('/physical/bulk', createBulkPhysicalInteractions);

// @desc    Get interactions between two profiles
// @route   GET /interactions/profile/between/:profileId/:targetProfileId
// @access  Private
router.get('/profile/between/:profileId/:targetProfileId', getInteractionsBetweenProfiles);

export default router; 