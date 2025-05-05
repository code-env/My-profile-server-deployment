import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import {
    getUserInteractions,
    getUserStats,
    getRecentInteractions,
    getInteractionFrequency,
    getInteractionsBetweenProfiles,
    createManualInteraction,
    getAllProfileInteractions
} from '../controllers/interaction.controller';

const router = Router();

// @desc    Get user's interactions with pagination and filters
// @route   GET /interactions/profile/:profileId
// @access  Private
router.get('/profile/:profileId', protect, getUserInteractions);

// @desc    Get interaction statistics
// @route   GET /interactions/profile/:profileId/stats
// @access  Private
router.get('/profile/:profileId/stats', protect, getUserStats);

// @desc    Get recent interactions
// @route   GET /interactions/profile/:profileId/recent
// @access  Private
router.get('/profile/:profileId/recent', protect, getRecentInteractions);

// @desc    Get interaction frequency with a specific profile
// @route   GET /interactions/profile/:profileId/frequency/:relationshipId
// @access  Private
router.get('/profile/:profileId/frequency/:relationshipId', protect, getInteractionFrequency);

// @desc    Get all interactions for a profile
// @route   GET /interactions/profile/:profileId/all
// @access  Private
router.get('/profile/:profileId/all', protect, getAllProfileInteractions);

// @desc    Create manual interaction
// @route   POST /interactions
// @access  Private
router.post('/', protect, createManualInteraction);

// @desc    Get interactions between two profiles
// @route   GET /interactions/profile/between/:profileId/:targetProfileId
// @access  Private
router.get('/profile/between/:profileId/:targetProfileId', protect, getInteractionsBetweenProfiles);

export default router; 