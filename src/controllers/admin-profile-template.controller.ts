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

export const bulkCreateTemplates = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const adminId = getAdminId(req);
    const templates = req.body.templates as TemplateInput[];

    if (!Array.isArray(templates) || templates.length === 0) {
      throw createHttpError(400, 'Templates array is required and must not be empty');
    }

    const results = {
      created: [] as any[],
      errors: [] as { index: number; template: TemplateInput; error: string }[]
    };

    for (let i = 0; i < templates.length; i++) {
      const template = templates[i];
      
      try {
        // Validate required category fields for each template
        if (template.categories) {
          for (const category of template.categories) {
            if (!category.name || !category.label) {
              throw new Error('Category name and label are required');
            }
            if (category.fields) {
              for (const field of category.fields) {
                if (!field.name || !field.label || field.order === undefined) {
                  throw new Error('Field name, label, and order are required');
                }
              }
            }
          }
        }

        const createdTemplate = await service.createTemplate(adminId, template);
        results.created.push({
          index: i,
          template: createdTemplate,
          templateType: template.profileType
        });
      } catch (error) {
        results.errors.push({
          index: i,
          template: template,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        });
      }
    }

    const statusCode = results.errors.length === 0 ? 201 : 
                      results.created.length === 0 ? 400 : 207; // 207 = Multi-Status

    res.status(statusCode).json({
      message: `Bulk creation completed. ${results.created.length} templates created, ${results.errors.length} errors.`,
      summary: {
        totalRequested: templates.length,
        successCount: results.created.length,
        errorCount: results.errors.length
      },
      results
    });
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
