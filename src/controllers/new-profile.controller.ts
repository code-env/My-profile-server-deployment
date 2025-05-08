// controllers/profile.controller.ts
import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import createHttpError from 'http-errors';
import { isValidObjectId } from 'mongoose';
import { ProfileService } from '../services/new-profile.service';
import { ProfileDocument } from '../models/profiles/new-profile.model';

interface ProfileFieldToggle {
  sectionKey: string;
  fieldKey: string;
  enabled: boolean;
}

interface ProfileFieldUpdate {
  sectionKey: string;
  fieldKey: string;
  value: any;
}

interface CreateProfileBody {
  templateId: string;
  profileInformation: {
    username: string;
    title?: string;
    accountHolder?: string;
    pid?: string;
    relationshipToAccountHolder?: string;
  };
  sections?: Array<{
    key: string;
    label: string;
    fields: Array<{
      key: string;
      value: any;
      enabled: boolean;
    }>;
  }>;
}

export class ProfileController {
  private service = new ProfileService();

  /** POST /p */
  createProfile = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req.user as any)?._id;
    if (!userId) throw createHttpError(401, 'Unauthorized');

    const { templateId, profileInformation, sections } = req.body as CreateProfileBody;
    if (!templateId) throw createHttpError(400, 'templateId is required');
    if (!profileInformation?.username) throw createHttpError(400, 'username is required');

    const profile = await this.service.createProfileWithContent(
      userId,
      templateId,
      profileInformation,
      sections
    );

    res.status(201).json({ success: true, profile });
  });

  /** POST /p/:profileId/fields */
  setEnabledFields = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req.user as any)?._id;
    if (!userId) throw createHttpError(401, 'Unauthorized');

    const { profileId } = req.params;
    if (!isValidObjectId(profileId)) throw createHttpError(400, 'Invalid profileId');

    const toggles = req.body as ProfileFieldToggle[];
    if (!Array.isArray(toggles)) throw createHttpError(400, 'Expected array of field toggles');

    const updated = await this.service.setEnabledFields(profileId, userId, toggles);
    res.json({ success: true, profile: updated });
  });

  /** PUT /p/:profileId/content */
  updateProfileContent = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req.user as any)?._id;
    if (!userId) throw createHttpError(401, 'Unauthorized');

    const { profileId } = req.params;
    if (!isValidObjectId(profileId)) throw createHttpError(400, 'Invalid profileId');

    const updates = req.body as ProfileFieldUpdate[];
    if (!Array.isArray(updates)) throw createHttpError(400, 'Expected array of field updates');

    const updated = await this.service.updateProfileContent(profileId, userId, updates);
    res.json({ success: true, profile: updated });
  });

  /** GET /p/:profileId */
  getProfile = asyncHandler(async (req: Request, res: Response) => {
    const { profileId } = req.params;
    if (!isValidObjectId(profileId)) throw createHttpError(400, 'Invalid profileId');

    const profile = await this.service.getProfile(profileId);
    res.json({ success: true, profile });
  });

  /** GET /p */
  getUserProfiles = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req.user as any)?._id;
    if (!userId) throw createHttpError(401, 'Unauthorized');

    const profiles = await this.service.getUserProfiles(userId);
    res.json({ success: true, profiles });
  });

  /** DELETE /p/:profileId */
  deleteProfile = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req.user as any)?._id;
    if (!userId) throw createHttpError(401, 'Unauthorized');

    const { profileId } = req.params;
    if (!isValidObjectId(profileId)) throw createHttpError(400, 'Invalid profileId');

    const deleted = await this.service.deleteProfile(profileId, userId);
    res.json({ success: deleted });
  });

  /** POST /default */
  createDefaultProfile = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req.user as any)?._id;
    if (!userId) throw createHttpError(401, 'Unauthorized');

    const profile = await this.service.createDefaultProfile(userId);
    res.status(201).json({ success: true, profile });
  });
}
