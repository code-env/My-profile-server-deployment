import { Request, Response } from 'express';
import mongoose from 'mongoose';
import listService from '../services/list.service';
import { ImportanceLevel, ListType } from '../models/List';

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

        const list = await listService.createList(req.body, user._id);
        return successResponse(res, list, 'List created successfully');
    } catch (error) {
        handleErrorResponse(error, res);
    }
};

export const getUserLists = async (req: Request, res: Response) => {
    try {
        const user: any = req.user!;
        const filters: any = {};

        // Apply filters from query params
        if (req.query.type) filters.type = req.query.type;
        if (req.query.importance) filters.importance = req.query.importance;
        if (req.query.relatedTask) filters.relatedTask = req.query.relatedTask;
        if (req.query.search) filters.search = req.query.search;

        const lists = await listService.getUserLists(user._id, filters);
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

        validateListData(req.body);

        const list = await listService.updateList(req.params.id, user._id, req.body);
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

        await listService.deleteList(req.params.id, user._id);
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

        if (!req.body.name) {
            return res.status(400).json({ error: 'Item name is required' });
        }

        const itemData = {
            name: req.body.name,
            isCompleted: false,
            createdAt: new Date(),
        };

        const list = await listService.addListItem(req.params.id, user._id, itemData);
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

        if (!req.params.itemIndex || isNaN(parseInt(req.params.itemIndex))) {
            return res.status(400).json({ error: 'Invalid item index' });
        }

        const itemIndex = parseInt(req.params.itemIndex);
        const list = await listService.updateListItem(
            req.params.id,
            user._id,
            itemIndex,
            req.body
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

        if (!req.params.itemIndex || isNaN(parseInt(req.params.itemIndex))) {
            return res.status(400).json({ error: 'Invalid item index' });
        }

        const itemIndex = parseInt(req.params.itemIndex);
        const list = await listService.deleteListItem(
            req.params.id,
            user._id,
            itemIndex
        );

        return successResponse(res, list, 'List item deleted successfully');
    } catch (error) {
        handleErrorResponse(error, res);
    }
};

export const toggleItemCompletion = async (req: Request, res: Response) => {
    try {
        const user: any = req.user!;
        if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'Invalid list ID' });
        }

        if (!req.params.itemIndex || isNaN(parseInt(req.params.itemIndex))) {
            return res.status(400).json({ error: 'Invalid item index' });
        }

        const itemIndex = parseInt(req.params.itemIndex);
        const list = await listService.toggleItemCompletion(
            req.params.id,
            user._id,
            itemIndex
        );

        return successResponse(res, list, 'Item completion status toggled successfully');
    } catch (error) {
        handleErrorResponse(error, res);
    }
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

        const list = await listService.addListComment(
            req.params.id,
            user._id,
            req.body.text
        );

        return successResponse(res, list, 'Comment added successfully');
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

        const list = await listService.likeList(req.params.id, user._id);
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

        const list = await listService.unlikeList(req.params.id, user._id);
        return successResponse(res, list, 'List unliked successfully');
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
