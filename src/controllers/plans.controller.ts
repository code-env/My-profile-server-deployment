import { Request, Response } from 'express';
import createHttpError from 'http-errors';
import asyncHandler from 'express-async-handler';
import plansService from '../services/plans.service';

// @desc    Get all plans (tasks and events) with filters
// @route   GET /plans
// @access  Private
export const getPlans = asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;
    const filters: any = {};

    // Apply filters from query params
    if (req.query.status) filters.status = req.query.status;
    if (req.query.priority) filters.priority = req.query.priority;
    if (req.query.category) filters.category = req.query.category;
    if (req.query.isAllDay) filters.isAllDay = req.query.isAllDay === 'true';
    if (req.query.profile) filters.profile = req.query.profile;
    if (req.query.search) filters.search = req.query.search;
    if (req.query.type) filters.type = req.query.type;

    // Date filters
    if (req.query.fromDate) {
        filters.fromDate = new Date(req.query.fromDate as string);
    }
    if (req.query.toDate) {
        filters.toDate = new Date(req.query.toDate as string);
    }

    const plans = await plansService.getPlans(user._id, filters);
    res.json({
        success: true,
        data: plans,
        message: 'Plans fetched successfully'
    });
});

// @desc    Get a single plan by ID
// @route   GET /plans/:id
// @access  Private
export const getPlanById = asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user!;

    if (!req.params.id) {
        throw createHttpError(400, 'Plan ID is required');
    }

    if (!req.query.type || !['Task', 'Event'].includes(req.query.type as string)) {
        throw createHttpError(400, 'Plan type (Task or Event) is required');
    }

    const plan = await plansService.getPlanById(req.params.id, req.query.type as 'Task' | 'Event');
    
    if (!plan) {
        throw createHttpError(404, 'Plan not found');
    }

    res.json({
        success: true,
        data: plan,
        message: 'Plan fetched successfully'
    });
}); 