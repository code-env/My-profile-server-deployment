import { Request, Response } from 'express';
import mongoose, { Types } from 'mongoose';
import listService from '../services/list.service';
import { ImportanceLevel, ListType } from '../models/List';
import { emitSocialInteraction } from '../utils/socketEmitter';

// Helper function to validate list data
const validateListData = (data: any) => {
    const errors: string[] = [];

    if (!data.name) errors.push('name is required');

    if (data.type && !Object.values(ListType).includes(data.type)) {
        errors.push(`type must be one of: ${Object.values(ListType).join(', ')}`);
    }

    if (data.importance && !Object.values(ImportanceLevel).includes(data.importance)) {
        errors.push(`importance must be one of: ${Object.values(ImportanceLevel).join(', ')}`);
    }

    if (errors.length > 0) {
        throw new Error(errors.join('; '));
    }
};

export const createList = async (req: Request, res: Response) => {
    try {
        const user: any = req.user!;
        validateListData(req.body);

        if (!req.body.profileId && !req.body.profile) {
            return res.status(400).json({ error: 'Profile ID is required' });
        }

        const list = await listService.createList(req.body, user._id, req.body.profile || req.body.profileId);
        return successResponse(res, list, 'List created successfully');
    } catch (error) {
        handleErrorResponse(error, res);
    }
};

export const getUserLists = async (req: Request, res: Response) => {
    try {
        const user: any = req.user!;
        const profileId = req.query.profileId as string || req.header('X-Profile-Id');
        
        if (!profileId) {
            return res.status(400).json({ error: 'Profile ID is required' });
        }

        const filters: any = {};

        // Apply filters from query params
        if (req.query.type) filters.type = req.query.type;
        if (req.query.importance) filters.importance = req.query.importance;
        if (req.query.relatedTask) filters.relatedTask = req.query.relatedTask;
        if (req.query.search) filters.search = req.query.search;

        const lists = await listService.getUserLists(profileId, filters);
        return successResponse(res, lists, 'Lists fetched successfully');
    } catch (error) {
        handleErrorResponse(error, res);
    }
};

export const getListById = async (req: Request, res: Response) => {
    try {
        const user: any = req.user!;
        if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'Invalid list ID' });
        }

        const list = await listService.getListById(req.params.id);
        return successResponse(res, list, 'List fetched successfully');
    } catch (error) {
        handleErrorResponse(error, res);
    }
};

export const updateList = async (req: Request, res: Response) => {
    try {
        const user: any = req.user!;
        if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'Invalid list ID' });
        }

        if (!req.body.profileId) {
            return res.status(400).json({ error: 'Profile ID is required' });
        }

        validateListData(req.body);

        const list = await listService.updateList(req.params.id, user._id, req.body.profileId, req.body);
        return successResponse(res, list, 'List updated successfully');
    } catch (error) {
        handleErrorResponse(error, res);
    }
};

export const deleteList = async (req: Request, res: Response) => {
    try {
        const user: any = req.user!;
        if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'Invalid list ID' });
        }

        if (!req.body.profileId) {
            return res.status(400).json({ error: 'Profile ID is required' });
        }

        await listService.deleteList(req.params.id, user._id, req.body.profileId);
        return successResponse(res, null, 'List deleted successfully');
    } catch (error) {
        handleErrorResponse(error, res);
    }
};

export const addListItem = async (req: Request, res: Response) => {
    try {
        const user: any = req.user!;
        if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'Invalid list ID' });
        }

        if (!req.body.profileId) {
            return res.status(400).json({ error: 'Profile ID is required' });
        }

        const itemData = {
            _id: new mongoose.Types.ObjectId(),
            profile: new Types.ObjectId(req.body.profile),
            name: req.body.name,
            isCompleted: req.body.isCompleted || false,
            createdAt: new Date(),
            completedAt: req.body.completedAt,
            assignedTo: req.body.assignedTo,
            repeat: req.body.repeat,
            reminders: req.body.reminders,
            duration: req.body.duration,
            status: req.body.status,
            subTasks: req.body.subTasks,
            attachments: req.body.attachments,
            category: req.body.category,
            notes: req.body.notes
        };
        const list = await listService.addListItem(req.params.id, user._id, req.body.profileId, itemData);
        return successResponse(res, list, 'List item added successfully');
    } catch (error) {
        handleErrorResponse(error, res);
    }
};

export const updateListItem = async (req: Request, res: Response) => {
    try {
        const user: any = req.user!;
        if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'Invalid list ID' });
        }
        if (!req.params.itemId || !mongoose.Types.ObjectId.isValid(req.params.itemId)) {
            return res.status(400).json({ error: 'Invalid item ID' });
        }

        if (!req.body.profileId) {
            return res.status(400).json({ error: 'Profile ID is required' });
        }

        const itemIndex = parseInt(req.params.itemIndex);
        const updateData = {
            name: req.body.name,
            isCompleted: req.body.isCompleted,
            completedAt: req.body.completedAt,
            assignedTo: req.body.assignedTo,
            repeat: req.body.repeat,
            reminders: req.body.reminders,
            duration: req.body.duration,
            status: req.body.status,
            subTasks: req.body.subTasks,
            attachments: req.body.attachments,
            category: req.body.category,
            notes: req.body.notes
        };
        const list = await listService.updateListItem(
            req.params.id,
            user._id,
            req.body.profileId,
            req.params.itemId,
            updateData
        );
        return successResponse(res, list, 'List item updated successfully');
    } catch (error) {
        handleErrorResponse(error, res);
    }
};

export const deleteListItem = async (req: Request, res: Response) => {
    try {
        const user: any = req.user!;
        if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'Invalid list ID' });
        }

        if (!req.params.itemId || !mongoose.Types.ObjectId.isValid(req.params.itemId)) {
            return res.status(400).json({ error: 'Invalid item ID' });
        }

        if (!req.body.profileId) {
            return res.status(400).json({ error: 'Profile ID is required' });
        }

        const list = await listService.deleteListItem(
            req.params.id,
            user._id,
            req.body.profileId,
            req.params.itemId
        );

        return successResponse(res, list, 'List item deleted successfully');
    } catch (error) {
        handleErrorResponse(error, res);
    }
};

export const toggleItemCompletion = async (req: Request, res: Response) => {
    try {
        const user: any = req.user!;
        const { id, itemId } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid list ID' });
        if (!itemId || !mongoose.Types.ObjectId.isValid(itemId)) return res.status(400).json({ error: 'Invalid item ID' });
        
        if (!req.body.profileId) {
            return res.status(400).json({ error: 'Profile ID is required' });
        }

        const list = await listService.toggleItemCompletion(id, user._id, req.body.profileId, itemId);
        return successResponse(res, list, 'Item completion status toggled successfully');
    } catch (error) { handleErrorResponse(error, res); }
};

export const addListComment = async (req: Request, res: Response) => {
    try {
        const user: any = req.user!;
        if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'Invalid list ID' });
        }

        if (!req.body.text) {
            return res.status(400).json({ error: 'Comment text is required' });
        }

        if (!req.body.profileId) {
            return res.status(400).json({ error: 'Profile ID is required' });
        }

        const list = await listService.addListComment(
            req.params.id,
            user._id,
            req.body.profileId,
            req.body.text
        );

        // Emit social interaction
        try {
            await emitSocialInteraction(user._id, {
                type: 'comment',
                profile: new Types.ObjectId(req.body.profileId),
                targetProfile: new Types.ObjectId(list.profile?._id as Types.ObjectId),
                contentId: (list as any)._id.toString(),
                content: req.body.text
            });
        } catch (error) {
            console.error('Failed to emit social interaction:', error);
        }

        return successResponse(res, list, 'Comment added successfully');
    } catch (error) {
        handleErrorResponse(error, res);
    }
};

export const likeComment = async (req: Request, res: Response) => {
    try {
        const user: any = req.user!;
        if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'Invalid list ID' });
        }

        if (!req.params.commentIndex || isNaN(parseInt(req.params.commentIndex))) {
            return res.status(400).json({ error: 'Invalid comment index' });
        }

        if (!req.body.profileId) {
            return res.status(400).json({ error: 'Profile ID is required' });
        }

        const commentIndex = parseInt(req.params.commentIndex);
        const list = await listService.likeComment(
            req.params.id,
            commentIndex,
            user._id,
            req.body.profileId
        );

        // Emit social interaction
        try {
            await emitSocialInteraction(user._id, {
                type: 'like',
                profile: new Types.ObjectId(req.body.profileId),
                targetProfile: new Types.ObjectId(list.profile?._id as Types.ObjectId),
                contentId: (list as any)._id.toString(),
                content: 'liked comment'
            });
        } catch (error) {
            console.error('Failed to emit social interaction:', error);
        }

        return successResponse(res, list, 'Comment liked successfully');
    } catch (error) {
        handleErrorResponse(error, res);
    }
};

export const unlikeComment = async (req: Request, res: Response) => {
    try {
        const user: any = req.user!;
        if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'Invalid list ID' });
        }

        if (!req.params.commentIndex || isNaN(parseInt(req.params.commentIndex))) {
            return res.status(400).json({ error: 'Invalid comment index' });
        }

        if (!req.body.profileId) {
            return res.status(400).json({ error: 'Profile ID is required' });
        }

        const commentIndex = parseInt(req.params.commentIndex);
        const list = await listService.unlikeComment(
            req.params.id,
            commentIndex,
            user._id,
            req.body.profileId
        );

        return successResponse(res, list, 'Comment unliked successfully');
    } catch (error) {
        handleErrorResponse(error, res);
    }
};

export const likeList = async (req: Request, res: Response) => {
    try {
        const user: any = req.user!;
        if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'Invalid list ID' });
        }

        if (!req.body.profileId) {
            return res.status(400).json({ error: 'Profile ID is required' });
        }

        const list = await listService.likeList(
            req.params.id,
            user._id,
            req.body.profileId
        );

        // Emit social interaction
        try {
            await emitSocialInteraction(user._id, {
                type: 'like',
                profile: new Types.ObjectId(req.body.profileId),
                targetProfile: new Types.ObjectId(list.profile?._id as Types.ObjectId),
                contentId: (list as any)._id.toString(),
                content: 'liked list'
            });
        } catch (error) {
            console.error('Failed to emit social interaction:', error);
        }

        return successResponse(res, list, 'List liked successfully');
    } catch (error) {
        handleErrorResponse(error, res);
    }
};

export const unlikeList = async (req: Request, res: Response) => {
    try {
        const user: any = req.user!;
        if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'Invalid list ID' });
        }

        if (!req.body.profileId) {
            return res.status(400).json({ error: 'Profile ID is required' });
        }

        const list = await listService.unlikeList(
            req.params.id,
            user._id,
            req.body.profileId
        );

        return successResponse(res, list, 'List unliked successfully');
    } catch (error) {
        handleErrorResponse(error, res);
    }
};

export const assignItemToProfile = async (req: Request, res: Response) => {
    try {
        const user: any = req.user!;
        const { id, itemId } = req.params;
        const { profileId, assigneeProfileId } = req.body;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid list ID' });
        if (itemId === undefined || !mongoose.Types.ObjectId.isValid(itemId)) return res.status(400).json({ error: 'Invalid item ID' });
        if (!profileId) return res.status(400).json({ error: 'Profile ID is required' });
        if (!assigneeProfileId) return res.status(400).json({ error: 'Assignee Profile ID is required' });
        const list = await listService.assignItemToProfile(id, user._id, profileId, itemId, assigneeProfileId);
        return successResponse(res, list, 'Item assigned to profile');
    } catch (error) { handleErrorResponse(error, res); }
};

export const addParticipant = async (req: Request, res: Response) => {
    try {
        const user: any = req.user!;
        const { id } = req.params;
        const { profileId, participantProfileId } = req.body;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid list ID' });
        if (!profileId) return res.status(400).json({ error: 'Profile ID is required' });
        if (!participantProfileId) return res.status(400).json({ error: 'Participant Profile ID is required' });
        const list = await listService.addParticipant(id, user._id, profileId, participantProfileId);
        return successResponse(res, list, 'Participant added');
    } catch (error) { handleErrorResponse(error, res); }
};

export const removeParticipant = async (req: Request, res: Response) => {
    try {
        const user: any = req.user!;
        const { id } = req.params;
        const { profileId, participantProfileId } = req.body;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid list ID' });
        if (!profileId) return res.status(400).json({ error: 'Profile ID is required' });
        if (!participantProfileId) return res.status(400).json({ error: 'Participant Profile ID is required' });
        const list = await listService.removeParticipant(id, user._id, profileId, participantProfileId);
        return successResponse(res, list, 'Participant removed');
    } catch (error) { handleErrorResponse(error, res); }
};

export const addAttachmentToItem = async (req: Request, res: Response) => {
    try {
        const user: any = req.user!;
        const { id, itemId } = req.params;
        const { attachment, profileId } = req.body;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid list ID' });
        if (itemId === undefined || !mongoose.Types.ObjectId.isValid(itemId)) return res.status(400).json({ error: 'Invalid item ID' });
        if (!attachment) return res.status(400).json({ error: 'Attachment is required' });
        if (!profileId) return res.status(400).json({ error: 'Profile ID is required' });
        const list = await listService.addAttachmentToItem(id, user._id, profileId, itemId, attachment);
        return successResponse(res, list, 'Attachment added to item');
    } catch (error) { handleErrorResponse(error, res); }
};

export const removeAttachmentFromItem = async (req: Request, res: Response) => {
    try {
        const user: any = req.user!;
        const { id, itemIndex, attachmentIndex } = req.params;
        const { profileId } = req.body;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid list ID' });
        if (itemIndex === undefined || isNaN(parseInt(itemIndex))) return res.status(400).json({ error: 'Invalid item index' });
        if (attachmentIndex === undefined || isNaN(parseInt(attachmentIndex))) return res.status(400).json({ error: 'Invalid attachment index' });
        if (!profileId) return res.status(400).json({ error: 'Profile ID is required' });
        const list = await listService.removeAttachmentFromItem(id, user._id, profileId, parseInt(itemIndex), parseInt(attachmentIndex));
        return successResponse(res, list, 'Attachment removed from item');
    } catch (error) { handleErrorResponse(error, res); }
};

export const addSubTask = async (req: Request, res: Response) => {
    try {
        const user: any = req.user!;
        const { id, itemId } = req.params;
        const { subTask, profileId } = req.body;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid list ID' });
        if (itemId === undefined || !mongoose.Types.ObjectId.isValid(itemId)) return res.status(400).json({ error: 'Invalid item ID' });
        if (!subTask) return res.status(400).json({ error: 'Sub-task is required' });
        if (!profileId) return res.status(400).json({ error: 'Profile ID is required' });
        const list = await listService.addSubTask(id, user._id, profileId, itemId, subTask);
        return successResponse(res, list, 'Sub-task added to item');
    } catch (error) { handleErrorResponse(error, res); }
};

export const removeSubTask = async (req: Request, res: Response) => {
    try {
        const user: any = req.user!;
        const { id, itemId, subTaskId } = req.params;
        const { profileId } = req.body;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid list ID' });
        if (!itemId || !mongoose.Types.ObjectId.isValid(itemId)) return res.status(400).json({ error: 'Invalid item ID' });
        if (!subTaskId || !mongoose.Types.ObjectId.isValid(subTaskId)) return res.status(400).json({ error: 'Invalid sub-task ID' });
        if (!profileId) return res.status(400).json({ error: 'Profile ID is required' });
        const list = await listService.removeSubTask(id, user._id, profileId, itemId, subTaskId);
        return successResponse(res, list, 'Sub-task removed');
    } catch (error) { handleErrorResponse(error, res); }
};

export const duplicateList = async (req: Request, res: Response) => {
    try {
        const user: any = req.user!;
        const { id } = req.params;
        const { profileId } = req.body;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid list ID' });
        if (!profileId) return res.status(400).json({ error: 'Profile ID is required' });
        const newList = await listService.duplicateList(id, user._id, profileId);
        return successResponse(res, newList, 'List duplicated successfully');
    } catch (error) { handleErrorResponse(error, res); }
};

export const checkAllItems = async (req: Request, res: Response) => {
    try {
        const user: any = req.user!;
        const { id } = req.params;
        const { profileId } = req.body;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid list ID' });
        if (!profileId) return res.status(400).json({ error: 'Profile ID is required' });
        const list = await listService.checkAllItems(id, user._id, profileId);
        return successResponse(res, list, 'All items marked as complete');
    } catch (error) { handleErrorResponse(error, res); }
};

export const uncheckAllItems = async (req: Request, res: Response) => {
    try {
        const user: any = req.user!;
        const { id } = req.params;
        const { profileId } = req.body;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid list ID' });
        if (!profileId) return res.status(400).json({ error: 'Profile ID is required' });
        const list = await listService.uncheckAllItems(id, user._id, profileId);
        return successResponse(res, list, 'All items marked as incomplete');
    } catch (error) { handleErrorResponse(error, res); }
};

export const shareList = async (req: Request, res: Response) => {
    try {
        const user: any = req.user!;
        const { id } = req.params;
        const { profileId, profileIds } = req.body;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid list ID' });
        if (!profileId) return res.status(400).json({ error: 'Profile ID is required' });
        if (!Array.isArray(profileIds) || profileIds.length === 0) return res.status(400).json({ error: 'profileIds array is required' });
        const list = await listService.shareList(id, user._id, profileId, profileIds);
        return successResponse(res, list, 'List shared successfully');
    } catch (error) { handleErrorResponse(error, res); }
};

export const toggleFavorite = async (req: Request, res: Response) => {
    try {
        const user: any = req.user!;
        if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'Invalid list ID' });
        }

        if (!req.body.profileId) {
            return res.status(400).json({ error: 'Profile ID is required' });
        }

        const list = await listService.toggleFavorite(req.params.id, user._id, req.body.profileId);
        return successResponse(res, list, 'List favorite status toggled successfully');
    } catch (error) {
        handleErrorResponse(error, res);
    }
};

export const generateShareableLink = async (req: Request, res: Response) => {
    try {
        const user: any = req.user!;
        if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'Invalid list ID' });
        }

        if (!req.body.profileId) {
            return res.status(400).json({ error: 'Profile ID is required' });
        }

        if (!req.body.access || !['view', 'edit'].includes(req.body.access)) {
            return res.status(400).json({ error: 'Access type must be either "view" or "edit"' });
        }

        const list = await listService.generateShareableLink(
            req.params.id,
            user._id,
            req.body.profileId,
            req.body.access
        );
        return successResponse(res, list, 'Shareable link generated successfully');
    } catch (error) {
        handleErrorResponse(error, res);
    }
};

export const disableShareableLink = async (req: Request, res: Response) => {
    try {
        const user: any = req.user!;
        if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'Invalid list ID' });
        }

        if (!req.body.profileId) {
            return res.status(400).json({ error: 'Profile ID is required' });
        }

        const list = await listService.disableShareableLink(
            req.params.id,
            user._id,
            req.body.profileId
        );
        return successResponse(res, list, 'Shareable link disabled successfully');
    } catch (error) {
        handleErrorResponse(error, res);
    }
};

export const getListByShareableLink = async (req: Request, res: Response) => {
    try {
        const { link } = req.params;
        if (!link) {
            return res.status(400).json({ error: 'Shareable link is required' });
        }

        const accessInfo = {
            profileId: req.user?._id?.toString(),
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        };

        const list = await listService.getListByShareableLink(link, accessInfo);
        return successResponse(res, list, 'List fetched successfully');
    } catch (error) {
        handleErrorResponse(error, res);
    }
};

// Helper functions
function handleErrorResponse(error: unknown, res: Response) {
    if (error instanceof Error && error.message === 'Authentication required') {
        return res.status(401).json({ error: error.message });
    }

    const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
        ...(process.env.NODE_ENV === 'development' && { stack: error instanceof Error ? error.stack : undefined })
    });
}

function successResponse(res: Response, data: any, message: string) {
    res.status(200).json({
        message: message,
        success: true,
        data
    });
}
