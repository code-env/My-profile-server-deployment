import { NextFunction, Request, Response } from 'express';
import { InteractionService } from '../services/interaction.service';
import { Types } from 'mongoose';
import { Interaction, InteractionMode, InteractionCategory, InteractionStatus } from '../models/Interaction';
import { logger } from '../utils/logger';
import asyncHandler from 'express-async-handler';
import createHttpError from 'http-errors';

const interactionService = new InteractionService(Interaction);

// validate the profileId
const validateProfileId = async (req: Request, res: Response, next: NextFunction) => {
    const profileId = new Types.ObjectId(req.params.profileId);
    const targetProfileId = new Types.ObjectId(req.params.targetProfileId);
    const user: any = req.user!;
    const userId = new Types.ObjectId(user._id);

    // profile id and target profile id are required
    if (!profileId || !targetProfileId) {
        return res.status(400).json({
            success: false,
            message: 'Profile ID and target profile ID are required'
        });
    }
    next();
}

// @desc    Get paginated interactions with filters
// @route   GET /interactions/:profileId
// @access  Private
export const getUserInteractions = asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;
    const userId = new Types.ObjectId(user._id);
    const profileId = new Types.ObjectId(req.params.profileId);

    // Parse filters from query parameters
    const filters: any = {};
    if (req.query.mode) filters.mode = req.query.mode;
    if (req.query.category) filters.category = req.query.category;
    if (req.query.status) filters.status = req.query.status;
    if (req.query.isPhysical) filters.isPhysical = req.query.isPhysical === 'true';
    if (req.query.startDate) filters.startDate = new Date(req.query.startDate as string);
    if (req.query.endDate) filters.endDate = new Date(req.query.endDate as string);

    // Parse pagination parameters
    const pagination = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 10,
        sortBy: req.query.sortBy as string,
        sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc'
    };

    const result = await interactionService.getUserInteractions(
        userId,
        profileId,
        filters,
        pagination
    );

    res.json({
        success: true,
        data: result
    });
});

// @desc    Get interaction statistics
// @route   GET /interactions/:profileId/stats
// @access  Private
export const getUserStats = asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;
    const userId = new Types.ObjectId(user._id);
    const profileId = new Types.ObjectId(req.params.profileId);
    const timeframe = (req.query.timeframe as 'day' | 'week' | 'month' | 'year') || 'month';

    const stats = await interactionService.getUserInteractionStats(
        userId,
        profileId,
        timeframe
    );

    res.json({
        success: true,
        data: stats
    });
});

// @desc    Get recent interactions summary
// @route   GET /interactions/:profileId/recent
// @access  Private
export const getRecentInteractions = asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;
    const userId = new Types.ObjectId(user._id);
    const profileId = new Types.ObjectId(req.params.profileId);
    const limit = parseInt(req.query.limit as string) || 5;

    const recentInteractions = await interactionService.getRecentInteractionsSummary(
        userId,
        profileId,
        limit
    );

    res.json({
        success: true,
        data: recentInteractions    
    });
});

// @desc    Get interaction frequency with a specific profile
// @route   GET /interactions/:profileId/frequency/:relationshipId
// @access  Private
export const getInteractionFrequency = asyncHandler(async (req: Request, res: Response) => {
    const profileId = new Types.ObjectId(req.params.profileId);
    const relationshipId = new Types.ObjectId(req.params.relationshipId);

    const frequency = await interactionService.getInteractionFrequency(
        profileId,
        relationshipId
    );

    res.json({
        success: true,
        data: frequency
    });
});

// @desc    Get all interactions for a profile
// @route   GET /interactions/:profileId/all
// @access  Private
export const getAllProfileInteractions = asyncHandler(async (req: Request, res: Response) => {
    const profileId = new Types.ObjectId(req.params.profileId);

    const interactions = await interactionService.getAllProfileInteractions(profileId);

    res.json({
        success: true,
        data: interactions
    });
});

// @desc    Create manual interaction
// @route   POST /interactions
// @access  Private
export const createManualInteraction = asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;
    const userId = new Types.ObjectId(user._id);

    const interaction = await interactionService.createManualInteraction(userId, req.body);

    res.json({
        success: true,
        data: interaction,
        message: 'Interaction created successfully'
    });
});

// @desc    Get interactions between two profiles
// @route   GET /interactions/between/:profileId/:targetProfileId
// @access  Private
export const getInteractionsBetweenProfiles = asyncHandler(async (req: Request, res: Response) => {
    const { profileId, targetProfileId } = req.params;

    // Validate ObjectIds
    if (!Types.ObjectId.isValid(profileId) || !Types.ObjectId.isValid(targetProfileId)) {
        throw createHttpError(400, 'Invalid profile IDs provided');
    }

    const interactionData = await interactionService.getInteractionsBetweenProfiles(
        new Types.ObjectId(profileId),
        new Types.ObjectId(targetProfileId)
    );

    res.json({
        success: true,
        data: interactionData,
        message: 'Interactions fetched successfully'
    });
});

// @desc    Create physical interaction (QR scan, NFC tap, etc.)
// @route   POST /interactions/physical
// @access  Private
export const createPhysicalInteraction = asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;
    const userId = new Types.ObjectId(user._id);
    
    const {
        profileId,
        scannedProfileId,
        interactionType = 'qr_scan', // Default to QR scan
        location,
        metadata
    } = req.body;

    // Validate required fields
    if (!profileId || !scannedProfileId) {
        throw createHttpError(400, 'Profile ID and scanned profile ID are required');
    }

    // Validate ObjectIds
    if (!Types.ObjectId.isValid(profileId) || !Types.ObjectId.isValid(scannedProfileId)) {
        throw createHttpError(400, 'Invalid profile IDs provided');
    }

    // Prevent self-interaction
    if (profileId === scannedProfileId) {
        throw createHttpError(400, 'Cannot create interaction with yourself');
    }

    let interaction;

    try {
        // Handle different types of physical interactions
        switch (interactionType) {
            case 'qr_scan':
                interaction = await interactionService.handleQRScanInteraction(
                    userId,
                    new Types.ObjectId(profileId),
                    new Types.ObjectId(scannedProfileId),
                    location
                );
                break;
            
            case 'nfc_tap':
                // Handle NFC tap interaction
                interaction = await interactionService.generateInteraction(
                    userId,
                    new Types.ObjectId(profileId),
                    new Types.ObjectId(scannedProfileId),
                    InteractionMode.IN_PERSON,
                    {
                        entityType: 'nfc',
                        action: 'tap',
                        metadata: {
                            interactionType: 'nfc_tap',
                            ...metadata
                        }
                    }
                );
                break;
            
            case 'proximity':
                // Handle proximity-based interaction (Bluetooth, etc.)
                interaction = await interactionService.generateInteraction(
                    userId,
                    new Types.ObjectId(profileId),
                    new Types.ObjectId(scannedProfileId),
                    InteractionMode.IN_PERSON,
                    {
                        entityType: 'proximity',
                        action: 'detected',
                        metadata: {
                            interactionType: 'proximity',
                            ...metadata
                        }
                    }
                );
                break;
            
            default:
                throw createHttpError(400, `Unsupported physical interaction type: ${interactionType}`);
        }

        res.status(201).json({
            success: true,
            data: interaction,
            message: `Physical interaction (${interactionType}) recorded successfully`
        });

    } catch (error: any) {
        logger.error('Physical interaction error:', error);
        
        // Handle permission errors gracefully
        if (error.message.includes('not allowed')) {
            throw createHttpError(403, error.message);
        }
        
        throw createHttpError(500, 'Failed to create physical interaction');
    }
});

// @desc    Bulk create physical interactions (for batch processing)
// @route   POST /interactions/physical/bulk
// @access  Private
export const createBulkPhysicalInteractions = asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;
    const userId = new Types.ObjectId(user._id);
    
    const { interactions } = req.body;

    if (!Array.isArray(interactions) || interactions.length === 0) {
        throw createHttpError(400, 'Interactions array is required and cannot be empty');
    }

    if (interactions.length > 50) {
        throw createHttpError(400, 'Cannot process more than 50 interactions at once');
    }

    const results = [];
    const errors = [];

    for (let i = 0; i < interactions.length; i++) {
        const interactionData = interactions[i];
        
        try {
            const {
                profileId,
                scannedProfileId,
                interactionType = 'qr_scan',
                location,
                metadata
            } = interactionData;

            // Validate required fields
            if (!profileId || !scannedProfileId) {
                throw new Error('Profile ID and scanned profile ID are required');
            }

            // Validate ObjectIds
            if (!Types.ObjectId.isValid(profileId) || !Types.ObjectId.isValid(scannedProfileId)) {
                throw new Error('Invalid profile IDs provided');
            }

            // Prevent self-interaction
            if (profileId === scannedProfileId) {
                throw new Error('Cannot create interaction with yourself');
            }

            let interaction;

            switch (interactionType) {
                case 'qr_scan':
                    interaction = await interactionService.handleQRScanInteraction(
                        userId,
                        new Types.ObjectId(profileId),
                        new Types.ObjectId(scannedProfileId),
                        location
                    );
                    break;
                
                default:
                    interaction = await interactionService.generateInteraction(
                        userId,
                        new Types.ObjectId(profileId),
                        new Types.ObjectId(scannedProfileId),
                        InteractionMode.IN_PERSON,
                        {
                            entityType: interactionType,
                            action: 'physical_interaction',
                            metadata: {
                                interactionType,
                                ...metadata
                            }
                        }
                    );
            }

            results.push({
                index: i,
                success: true,
                data: interaction
            });

        } catch (error: any) {
            logger.error(`Bulk physical interaction error at index ${i}:`, error);
            errors.push({
                index: i,
                error: error.message,
                data: interactionData
            });
        }
    }

    res.status(200).json({
        success: true,
        data: {
            processed: results.length,
            failed: errors.length,
            total: interactions.length,
            results,
            errors
        },
        message: `Processed ${results.length} of ${interactions.length} physical interactions`
    });
}); 