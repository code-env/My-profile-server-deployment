import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import createHttpError from 'http-errors';
import { ProfileTemplate } from '../models/ProfileTemplate';
import { logger } from '../utils/logger';

// @desc    Create a new profile template
// @route   POST /api/templates
// @access  Private (Admin/SuperAdmin)
export const createTemplate = asyncHandler(async (req: Request, res: Response) => {
  const user: any = req.user!;
  
  // Only admin and superadmin can create templates
  if (user.role !== 'admin' && user.role !== 'superadmin') {
    throw createHttpError(403, 'Not authorized to create templates');
  }

  const template = await ProfileTemplate.create({
    ...req.body,
    createdBy: user._id,
  });

  logger.info(`Template created: ${template._id} by user: ${user._id}`);
  res.status(201).json(template);
});

// @desc    Get all public templates
// @route   GET /api/templates
// @access  Private
export const getTemplates = asyncHandler(async (req: Request, res: Response) => {
  const { category, search, sort = 'usageCount' } = req.query;
  const query: any = { isPublic: true };

  // Apply category filter
  if (category) {
    query.category = category;
  }

  // Apply search filter
  if (search) {
    query.$text = { $search: search };
  }

  // Apply sorting
  let sortOption: any = {};
  switch (sort) {
    case 'newest':
      sortOption = { createdAt: -1 };
      break;
    case 'popular':
      sortOption = { usageCount: -1 };
      break;
    case 'name':
      sortOption = { name: 1 };
      break;
    default:
      sortOption = { usageCount: -1 };
  }

  const templates = await ProfileTemplate.find(query)
    .sort(sortOption)
    .select('-fields -layout') // Exclude detailed fields for list view
    .lean();

  res.json(templates);
});

// @desc    Get template by ID
// @route   GET /api/templates/:id
// @access  Private
export const getTemplateById = asyncHandler(async (req: Request, res: Response) => {
  const template = await ProfileTemplate.findById(req.params.id);
  
  if (!template) {
    throw createHttpError(404, 'Template not found');
  }

  if (!template.isPublic) {
    const user: any = req.user!;
    if (template.createdBy.toString() !== user._id.toString() && 
        user.role !== 'admin' && user.role !== 'superadmin') {
      throw createHttpError(403, 'Not authorized to view this template');
    }
  }

  res.json(template);
});

// @desc    Update template
// @route   PUT /api/templates/:id
// @access  Private (Admin/SuperAdmin/Owner)
export const updateTemplate = asyncHandler(async (req: Request, res: Response) => {
  const user: any = req.user!;
  const template = await ProfileTemplate.findById(req.params.id);

  if (!template) {
    throw createHttpError(404, 'Template not found');
  }

  // Check authorization
  if (template.createdBy.toString() !== user._id.toString() && 
      user.role !== 'admin' && user.role !== 'superadmin') {
    throw createHttpError(403, 'Not authorized to update this template');
  }

  const updatedTemplate = await ProfileTemplate.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );

  logger.info(`Template updated: ${template._id} by user: ${user._id}`);
  res.json(updatedTemplate);
});

// @desc    Delete template
// @route   DELETE /api/templates/:id
// @access  Private (Admin/SuperAdmin/Owner)
export const deleteTemplate = asyncHandler(async (req: Request, res: Response) => {
  const user: any = req.user!;
  const template:any = await ProfileTemplate.findById(req.params.id);

  if (!template) {
    throw createHttpError(404, 'Template not found');
  }

  // Check authorization
  if (template.createdBy.toString() !== user._id.toString() && 
      user.role !== 'admin' && user.role !== 'superadmin') {
    throw createHttpError(403, 'Not authorized to delete this template');
  }

  await template.remove();
  logger.info(`Template deleted: ${template._id} by user: ${user._id}`);
  res.json({ message: 'Template removed' });
});
