
import {
    ProfileTemplate,
    IProfileTemplate,
    PROFILE_TYPE_ENUM,
    ProfileCategory,
    ProfileType
  } from '../models/profiles/profile-template';
  
  import mongoose, { isValidObjectId } from 'mongoose';
  import createHttpError from 'http-errors';
  import { logger } from '../utils/logger';         // ← still here if you need it
  
  /* ------------------------------------------------------------------ */
  /* 🗃️  DTO-like helper types – keep in this file for brevity          */
  /* ------------------------------------------------------------------ */
  export interface TemplateInput {
    profileCategory: ProfileCategory;
    profileType: ProfileType;
    name: string;
    slug: string;
    sections: any[];                 // use a real type if you prefer
    version?: number;                // defaults to 1
    isActive?: boolean;              // defaults to false
  }
  
  export interface TemplateUpdate {
    name?: string;
    sections?: any[];
    isActive?: boolean;
  }
  
  /* ------------------------------------------------------------------ */
  /* 🛠️  Service class                                                  */
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
  
      const version = input.version ?? 1;
  

      const exists = await ProfileTemplate.findOne({
        profileCategory: input.profileCategory,
        profileType: input.profileType,
        version
      });
      if (exists) {
        throw createHttpError(
          409,
          `Version ${version} of "${input.profileType}" already exists`
        );
      }
  
      
      const template = new ProfileTemplate({
        ...input,
        version,
        createdBy: new mongoose.Types.ObjectId(adminId),
        isActive: input.isActive ?? false
      });
  
      await template.save();
      console.log('✅ Template created:', template._id );
      return template;
    }
  
    
    async listTemplates(filter?: {
      isActive?: boolean;
      category?: ProfileCategory;
      type?: ProfileType;
    }): Promise<IProfileTemplate[]> {
      console.log('🔍 Listing templates with filter:', filter);
      const query: any = {};
      if (filter?.isActive !== undefined) query.isActive = filter.isActive;
      if (filter?.category) query.profileCategory = filter.category;
      if (filter?.type) query.profileType = filter.type;
  
      const items = await ProfileTemplate.find(query).sort({ updatedAt: -1 }).lean();
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
  
      /* immutable header fields ------------------------------------- */
      const immutable = ['profileCategory', 'profileType', 'version', 'createdBy'];
      const safe: any = { ...updates };
      immutable.forEach(field => delete safe[field]);
  
      Object.assign(template, safe, { updatedBy: adminId });
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
  