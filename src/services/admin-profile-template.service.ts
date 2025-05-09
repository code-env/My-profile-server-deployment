import {
  ProfileTemplate,
  IProfileTemplate,
  PROFILE_TYPE_ENUM,
  ProfileCategory,
  ProfileType
} from '../models/profiles/profile-template';

import mongoose, { isValidObjectId } from 'mongoose';
import createHttpError from 'http-errors';

/* ------------------------------------------------------------------ */
/* 🗃️  Updated DTO-like helper types                                  */
/* ------------------------------------------------------------------ */
export interface TemplateInput {
  profileCategory: ProfileCategory;
  profileType: ProfileType;
  name: string;
  slug: string;
  categories: {        // Changed from 'sections' to 'categories'
    name: string;
    label: string;
    icon?: string;
    collapsible?: boolean;
    fields: {
      name: string;
      label: string;
      widget: string;
      content?: any;
      order: number;
      enabled: boolean;
      required?: boolean;
      default?: any;
      placeholder?: string;
      options?: {
        label: string;
        value: any;
      }[];
      validation?: {
        min?: number;
        max?: number;
        regex?: string;
      };
    }[];
  }[];
}

export interface TemplateUpdate {
  name?: string;
  categories?: any[];  // Can use more specific type if needed
}

/* ------------------------------------------------------------------ */
/* 🛠️  Updated Service class                                          */
/* ------------------------------------------------------------------ */
export class AdminProfileService {
  /* ────────────────────────────────────────────────────────────────
     CREATE
     ──────────────────────────────────────────────────────────────── */
  async createTemplate(
    adminId: string,
    input: TemplateInput
  ): Promise<IProfileTemplate> {
    console.log('📄 Creating new template:', input.profileType, 'by admin', adminId);

    if (!PROFILE_TYPE_ENUM.includes(input.profileType)) {
      throw createHttpError(400, 'Invalid profileType');
    }

    // Check if template with same category/type already exists
    const exists = await ProfileTemplate.findOne({
      profileCategory: input.profileCategory,
      profileType: input.profileType
    });
    if (exists) {
      throw createHttpError(
        409,
        `Template for "${input.profileType}" already exists`
      );
    }

    const template = new ProfileTemplate({
      ...input,
      createdBy: new mongoose.Types.ObjectId(adminId)
    });

    await template.save();
    console.log('✅ Template created:', template._id);
    return template;
  }

  async listTemplates(filter?: {
    category?: ProfileCategory;
    type?: ProfileType;
  }): Promise<IProfileTemplate[]> {
    console.log('🔍 Listing templates with filter:', filter);
    const query: any = {};
    if (filter?.category) query.profileCategory = filter.category;
    if (filter?.type) query.profileType = filter.type;

    const items = await ProfileTemplate.find(query)
      .sort({ updatedAt: -1 })
      .lean();
    console.log('ℹ️  Found', items.length, 'templates');
    return items;
  }

  async getTemplateById(id: string): Promise<IProfileTemplate | null> {
    console.log('🔍 Fetching template by ID:', id);

    if (!isValidObjectId(id)) {
      throw createHttpError(400, 'Invalid template ID');
    }

    const tpl = await ProfileTemplate.findById(id);
    console.log(tpl ? '✅ Template found' : '❌ Template not found');
    return tpl;
  }

  async updateTemplate(
    templateId: string,
    adminId: string,
    updates: TemplateUpdate
  ): Promise<IProfileTemplate | null> {
    console.log('📝 Updating template:', templateId);
    console.log('ℹ️  Updates:', JSON.stringify(updates, null, 2));

    if (!isValidObjectId(templateId)) {
      throw createHttpError(400, 'Invalid template ID');
    }

    const template = await ProfileTemplate.findById(templateId);
    if (!template) {
      console.log('❌ Template not found:', templateId);
      return null;
    }

    // Update only allowed fields
    if (updates.name) template.name = updates.name;
    if (updates.categories) template.categories = updates.categories;

    template.updatedBy = new mongoose.Types.ObjectId(adminId);
    await template.save();
    console.log('✅ Template updated:', templateId);
    return template;
  }

  async deleteTemplate(templateId: string): Promise<boolean> {
    console.log('🗑️  Deleting template:', templateId);

    if (!isValidObjectId(templateId)) {
      throw createHttpError(400, 'Invalid template ID');
    }

    const result = await ProfileTemplate.deleteOne({ _id: templateId });
    const success = result.deletedCount > 0;
    console.log(success ? '✅ Template deleted' : '❌ Template not found');
    return success;
  }
}
