import { Request, Response, NextFunction } from 'express';
import createHttpError from 'http-errors';
import { AdminProfileService, TemplateInput, TemplateUpdate } from '../services/admin-profile-template.service';

import {
  ProfileCategory as ModelProfileCategory,
  ProfileType as ModelProfileType,
  PROFILE_TYPE_ENUM
} from '../models/profiles/profile-template';

const service = new AdminProfileService();

type ProfileCategory = ModelProfileCategory;
type ProfileType = ModelProfileType;

const getAdminId = (req: Request) => {
  const id = (req as any).user?._id;
  // const id = "681a5eaa74eed7c84b9778dd"
  if (!id) throw createHttpError(401, 'Admin identity not found on request');
  return id as string;
};

export const createTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const adminId = getAdminId(req);
    const input = req.body as TemplateInput;

    // Validate required category fields
    if (input.categories) {
      for (const category of input.categories) {
        if (!category.name || !category.label) {
          throw createHttpError(400, 'Category name and label are required');
        }
        if (category.fields) {
          for (const field of category.fields) {
            if (!field.name || !field.label || field.order === undefined) {
              throw createHttpError(400, 'Field name, label, and order are required');
            }
          }
        }
      }
    }

    const tpl = await service.createTemplate(adminId, input);
    res.status(201).json(tpl);
  } catch (err) {
    next(err);
  }
};

export const listTemplates = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const filter = {
      category: req.query.category as ProfileCategory | undefined,
      type: req.query.type as ProfileType | undefined
    };

    // Validate query params against enums if provided
    if (filter.category && !['individual', 'accessory', 'group'].includes(filter.category)) {
      throw createHttpError(400, 'Invalid category value');
    }

    const items = await service.listTemplates(filter);
    res.json(items);
  } catch (err) {
    next(err);
  }
};

export const getTemplateById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const tpl = await service.getTemplateById(req.params.id);
    if (!tpl) throw createHttpError(404, 'Template not found');
    res.json(tpl);
  } catch (err) {
    next(err);
  }
};

export const updateTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const adminId = getAdminId(req);
    const updates = req.body as TemplateUpdate;

    // Validate fields if provided in update
    if (updates.categories) {
      for (const category of updates.categories) {
        if (!category.name || !category.label) {
          throw createHttpError(400, 'Category name and label are required');
        }
      }
    }

    const tpl = await service.updateTemplate(req.params.id, adminId, updates);
    if (!tpl) throw createHttpError(404, 'Template not found');
    res.json(tpl);
  } catch (err) {
    next(err);
  }
};

export const deleteTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const success = await service.deleteTemplate(req.params.id);
    if (!success) throw createHttpError(404, 'Template not found');
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};
