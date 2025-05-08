import { Profile, ProfileDocument } from '../models/profiles/new-profile.model';
import { isValidObjectId } from 'mongoose';
import createHttpError from 'http-errors';
import { logger } from '../utils/logger';
import { User } from '../models/User';
import { ProfileTemplate } from '../models/profiles/profile-template';
import { generateUniqueConnectLink } from '../utils/crypto';
import mongoose from 'mongoose';

// Extended interface for profile sections that includes value and enabled status
interface ProfileSection {
  key: string;
  label: string;
  fields: Array<{
    key: string;
    value: any;
    enabled: boolean;
  }>;
}

export class ProfileService {
  /**
   * Creates a new profile based on a template
   * @param userId The user ID creating the profile
   * @param templateId The template ID to base the profile on
   * @returns The created profile document
   */
  async createProfile(
    userId: string,
    templateId: string
  ): Promise<ProfileDocument> {
    logger.info(`Creating new profile for user ${userId} using template ${templateId}`);

    // Validate inputs
    if (!isValidObjectId(userId) || !isValidObjectId(templateId)) {
      throw createHttpError(400, 'Invalid user ID or template ID');
    }

    // Get the template
    const template = await ProfileTemplate.findById(templateId);
    if (!template) {
      throw createHttpError(404, 'Template not found');
    }

    // Check if user already has a profile of this type
    const existingProfile = await Profile.findOne({
      'profileInformation.creator': userId,
      templatedId: templateId
    });
    if (existingProfile) {
      throw createHttpError(409, 'User already has a profile using this template');
    }

    // Generate unique links
    const [connectLink, profileLink] = await Promise.all([
      generateUniqueConnectLink(),
      generateUniqueConnectLink()
    ]);

    // Create initial profile sections with all fields disabled by default
    const initialSections = template.categories.map(category => ({
      key: category.name,
      label: category.label,
      fields: category.fields.map(field => ({
        key: field.name,
        value: field.default || null,
        enabled: false // Fields are disabled by default
      }))
    }));

    const profile = new Profile({
      profileCategory: template.profileCategory,
      profileType: template.profileType,
      templatedId: template._id,
      profileInformation: {
        username: '', // Will be set in update
        profileLink: profileLink,
        creator: new mongoose.Types.ObjectId(userId),
        connectLink,
        followLink: profileLink,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      sections: initialSections
    });

    await profile.save();
    logger.info(`Profile created successfully: ${profile._id}`);
    return profile;
  }

  /**
   * Enables/disables fields in a profile
   * @param profileId The profile ID
   * @param userId The user ID
   * @param enabledFields Array of field keys to enable/disable
   * @returns The updated profile document
   */
  async setEnabledFields(
    profileId: string,
    userId: string,
    enabledFields: Array<{
      sectionKey: string;
      fieldKey: string;
      enabled: boolean;
    }>
  ): Promise<ProfileDocument> {
    logger.info(`Updating enabled fields for profile ${profileId}`);

    if (!isValidObjectId(profileId) || !isValidObjectId(userId)) {
      throw createHttpError(400, 'Invalid profile ID or user ID');
    }

    const profile = await Profile.findById(profileId);
    if (!profile) {
      throw createHttpError(404, 'Profile not found');
    }

    // Verify user has permission to update
    if (profile.profileInformation.creator.toString() !== userId) {
      throw createHttpError(403, 'You do not have permission to update this profile');
    }

    // Update field enabled status
    enabledFields.forEach(({ sectionKey, fieldKey, enabled }) => {
      const section = profile.sections.find(s => s.key === sectionKey);
      if (section) {
        const field = section.fields.find(f => f.key === fieldKey);
        if (field) {
          field.enabled = enabled;
        }
      }
    });

    profile.profileInformation.updatedAt = new Date();
    await profile.save();
    logger.info(`Enabled fields updated for profile ${profileId}`);
    return profile;
  }

  /**
   * Updates profile content for enabled fields
   * @param profileId The profile ID to update
   * @param userId The user ID making the update
   * @param updates Object containing field updates
   * @returns The updated profile document
   */
  async updateProfileContent(
    profileId: string,
    userId: string,
    updates: Array<{
      sectionKey: string;
      fieldKey: string;
      value: any;
    }>
  ): Promise<ProfileDocument> {
    logger.info(`Updating content for profile ${profileId}`);

    if (!isValidObjectId(profileId) || !isValidObjectId(userId)) {
      throw createHttpError(400, 'Invalid profile ID or user ID');
    }

    const profile = await Profile.findById(profileId);
    if (!profile) {
      throw createHttpError(404, 'Profile not found');
    }

    // Verify user has permission to update
    if (profile.profileInformation.creator.toString() !== userId) {
      throw createHttpError(403, 'You do not have permission to update this profile');
    }

    // Get template for validation
    const template = await ProfileTemplate.findById(profile.templatedId);
    if (!template) {
      throw createHttpError(404, 'Template not found');
    }

    // Validate and apply updates
    updates.forEach(({ sectionKey, fieldKey, value }) => {
      const section = profile.sections.find(s => s.key === sectionKey);
      if (!section) {
        throw createHttpError(400, `Invalid section: ${sectionKey}`);
      }

      const field = section.fields.find(f => f.key === fieldKey);
      if (!field) {
        throw createHttpError(400, `Invalid field: ${fieldKey} in section ${sectionKey}`);
      }

      if (!field.enabled) {
        throw createHttpError(400, `Field ${fieldKey} is not enabled`);
      }

      // Validate against template field type if needed
      const templateSection = template.categories.find(c => c.name === sectionKey);
      const templateField = templateSection?.fields.find(f => f.name === fieldKey);
      if (templateField) {
        // Add type-specific validation based on widget type
        switch (templateField.widget) {
          case 'number':
            if (typeof value !== 'number') {
              throw createHttpError(400, `Field ${fieldKey} must be a number`);
            }
            if (templateField.validation?.min !== undefined && value < templateField.validation.min) {
              throw createHttpError(400, `Field ${fieldKey} must be at least ${templateField.validation.min}`);
            }
            if (templateField.validation?.max !== undefined && value > templateField.validation.max) {
              throw createHttpError(400, `Field ${fieldKey} must be at most ${templateField.validation.max}`);
            }
            break;
          case 'email':
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
              throw createHttpError(400, `Field ${fieldKey} must be a valid email`);
            }
            break;
          // Add other validation cases as needed
        }
      }

      // Type assertion to allow value assignment
      (field as any).value = value;
    });

    profile.profileInformation.updatedAt = new Date();
    await profile.save();
    logger.info(`Profile content updated for ${profileId}`);
    return profile;
  }

  /**
   * Gets a profile by ID
   * @param profileId The profile ID
   * @returns The profile document
   */
  async getProfile(profileId: string): Promise<ProfileDocument> {
    logger.info(`Fetching profile ${profileId}`);

    if (!isValidObjectId(profileId)) {
      throw createHttpError(400, 'Invalid profile ID');
    }

    const profile = await Profile.findById(profileId);
    if (!profile) {
      throw createHttpError(404, 'Profile not found');
    }

    return profile;
  }

  /**
   * Gets all profiles for a user
   * @param userId The user ID
   * @returns Array of profile documents
   */
  async getUserProfiles(userId: string): Promise<ProfileDocument[]> {
    logger.info(`Fetching all profiles for user ${userId}`);

    if (!isValidObjectId(userId)) {
      throw createHttpError(400, 'Invalid user ID');
    }

    return await Profile.find({ 'profileInformation.creator': userId });
  }

  /**
   * Deletes a profile
   * @param profileId The profile ID
   * @param userId The user ID requesting deletion
   * @returns Boolean indicating success
   */
  async deleteProfile(profileId: string, userId: string): Promise<boolean> {
    logger.info(`Deleting profile ${profileId} by user ${userId}`);

    if (!isValidObjectId(profileId) || !isValidObjectId(userId)) {
      throw createHttpError(400, 'Invalid profile ID or user ID');
    }

    const profile = await Profile.findById(profileId);
    if (!profile) {
      throw createHttpError(404, 'Profile not found');
    }

    if (profile.profileInformation.creator.toString() !== userId) {
      throw createHttpError(403, 'You do not have permission to delete this profile');
    }

    const result = await Profile.deleteOne({ _id: profileId });
    return result.deletedCount > 0;
  }

  /**
   * Creates a default personal profile for a new user
   * @param userId The user ID
   * @returns The created profile document
   */
  async createDefaultProfile(userId: string): Promise<ProfileDocument> {
    logger.info(`Creating default personal profile for user ${userId}`);

    // Get the default personal profile template
    const template = await ProfileTemplate.findOne({
      profileType: 'personal',
      profileCategory: 'individual'
    });

    if (!template) {
      throw createHttpError(404, 'Default personal template not found');
    }
    const templateId = template.toJSON()._id.toString();

    return this.createProfile(userId, templateId);
  }
}