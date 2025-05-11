import { ProfileModel as Profile, ProfileDocument } from '../models/profile.model';
import { isValidObjectId } from 'mongoose';
import createHttpError from 'http-errors';
import { logger } from '../utils/logger';
import { User } from '../models/User';
import { ProfileTemplate } from '../models/profiles/profile-template';
import { generateUniqueConnectLink, generateReferralCode, generateSecondaryId } from '../utils/crypto';
import mongoose from 'mongoose';

// No custom interfaces needed - we'll use type assertions with 'any' where necessary

export class ProfileService {
  /**
   * Creates a profile with content in one step
   * @param userId The user ID creating the profile
   * @param templateId The template ID to base the profile on
   * @param profileInformation Basic profile information
   * @param sections Optional sections with field values and enabled status
   * @returns The created profile document
   */
  async createProfileWithContent(
    userId: string,
    templateId: string,
    profileInformation: {
      username: string;
      title?: string;
      accountHolder?: string;
      pid?: string;
      relationshipToAccountHolder?: string;
    },
    sections?: Array<{
      key: string;
      label: string;
      fields: Array<{
        key: string;
        value: any;
        enabled: boolean;
      }>;
    }>
  ): Promise<ProfileDocument> {
    logger.info(`Creating profile with content for user ${userId} using template ${templateId}`);

    // Create the base profile
    const profile = await this.createProfile(userId, templateId);

    // Update profile information
    if (profileInformation) {
      // Get user data to ensure we use fullName for username
      const user = await User.findById(userId);
      profile.profileInformation.username = user?.fullName || profileInformation.username;

      if (profileInformation.title) profile.profileInformation.title = profileInformation.title;
      if (profileInformation.accountHolder) profile.profileInformation.accountHolder = profileInformation.accountHolder;
      if (profileInformation.pid) profile.profileInformation.pid = profileInformation.pid;
      if (profileInformation.relationshipToAccountHolder)
        profile.profileInformation.relationshipToAccountHolder = profileInformation.relationshipToAccountHolder;
    }

    // Update sections and fields if provided
    if (sections && sections.length > 0) {
      // For each provided section
      for (const providedSection of sections) {
        // Find matching section in profile
        const profileSection = profile.sections.find(s => s.key === providedSection.key);
        if (profileSection) {
          // Update fields in the section
          for (const providedField of providedSection.fields) {
            const profileField = profileSection.fields.find(f => f.key === providedField.key);
            if (profileField) {
              // Use type assertion to allow property assignment
              (profileField as any).value = providedField.value;
              profileField.enabled = providedField.enabled;
            }
          }
        }
      }
    }

    // Save the updated profile
    await profile.save();
    logger.info(`Profile with content created successfully: ${profile._id}`);
    return profile;
  }

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

    // Generate a unique referral link
    const referralCode = generateReferralCode();
    const referralLink = `mypts-ref-${referralCode}`;

    // Generate a unique secondary ID
    const secondaryId = await generateSecondaryId(async (id: string) => {
      // Check if the ID is unique
      const existingProfile = await Profile.findOne({ secondaryId: id });
      return !existingProfile; // Return true if no profile with this ID exists
    });

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

    // Get user data for profile username (using fullName instead of username)
    const user = await User.findById(userId);
    const profileUsername = user?.fullName || user?.username || '';

    const profile = new Profile({
      profileCategory: template.profileCategory,
      profileType: template.profileType,
      secondaryId, // Add the secondary ID
      templatedId: template._id,
      profileInformation: {
        username: profileUsername,
        profileLink: profileLink,
        creator: new mongoose.Types.ObjectId(userId),
        connectLink,
        followLink: profileLink,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      ProfileReferal: {
        referalLink: referralLink,
        referals: 0
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
   * Get all profiles with pagination and filtering (admin only)
   * @param filter Filter criteria
   * @param skip Number of documents to skip
   * @param limit Maximum number of documents to return
   * @returns Array of profile documents
   */
  async getAllProfiles(filter: any = {}, skip = 0, limit = 20): Promise<ProfileDocument[]> {
    logger.info(`Fetching all profiles with filter: ${JSON.stringify(filter)}, skip: ${skip}, limit: ${limit}`);

    return await Profile.find(filter)
      .sort({ 'profileInformation.createdAt': -1 })
      .skip(skip)
      .limit(limit);
  }

  /**
   * Count profiles matching a filter
   * @param filter Filter criteria
   * @returns Count of matching profiles
   */
  async countProfiles(filter: any = {}): Promise<number> {
    logger.info(`Counting profiles with filter: ${JSON.stringify(filter)}`);

    return await Profile.countDocuments(filter);
  }

  /**
   * Updates a profile's username and description
   * @param profileId The profile ID to update
   * @param userId The user ID making the update
   * @param username The new username for the profile
   * @param description Optional description for the profile
   * @returns The updated profile document
   */
  async updateProfileBasicInfo(
    profileId: string,
    userId: string,
    username: string,
    description?: string
  ): Promise<ProfileDocument> {
    logger.info(`Updating basic info for profile ${profileId}`);

    if (!isValidObjectId(profileId) || !isValidObjectId(userId)) {
      throw createHttpError(400, 'Invalid profile ID or user ID');
    }

    if (!username || username.trim() === '') {
      throw createHttpError(400, 'Username is required');
    }

    const profile = await Profile.findById(profileId);
    if (!profile) {
      throw createHttpError(404, 'Profile not found');
    }

    // Verify user has permission to update
    if (profile.profileInformation.creator.toString() !== userId) {
      throw createHttpError(403, 'You do not have permission to update this profile');
    }

    // Get user data to ensure we're using the correct fullName
    const user = await User.findById(userId);
    if (!user) {
      throw createHttpError(404, 'User not found');
    }

    // Update the profile username with the user's fullName
    profile.profileInformation.username = user.fullName || username;
    profile.profileInformation.updatedAt = new Date();

    // If description is provided, update it using the updateProfileContent method
    if (description !== undefined) {
      try {
        // Find the basic section that contains the bio/description field
        const basicSection = profile.sections.find(s =>
          s.key === 'basic' ||
          s.fields.some(f => f.key === 'bio' || f.key === 'description')
        );

        if (basicSection) {
          // Find the bio/description field
          const bioField = basicSection.fields.find(f =>
            f.key === 'bio' || f.key === 'description'
          );

          if (bioField) {
            // Use the existing updateProfileContent method to update the field
            // First, ensure the field is enabled
            await this.setEnabledFields(profileId, userId, [
              {
                sectionKey: basicSection.key,
                fieldKey: bioField.key,
                enabled: true
              }
            ]);

            // Then update the content
            await this.updateProfileContent(profileId, userId, [
              {
                sectionKey: basicSection.key,
                fieldKey: bioField.key,
                value: description
              }
            ]);

            logger.info(`Updated description for profile ${profileId}`);
          } else {
            logger.warn(`Could not find bio/description field in profile ${profileId}`);
          }
        } else {
          // If the section doesn't exist, we can't add the description
          logger.warn(`Could not find basic section in profile ${profileId} to update description`);
        }
      } catch (error) {
        logger.error(`Error updating description for profile ${profileId}:`, error);
        // Don't throw the error to avoid disrupting the username update
      }
    }

    await profile.save();
    logger.info(`Basic info updated for profile ${profileId}`);
    return profile;
  }

  /**
   * Creates a default personal profile for a new user
   * @param userId The user ID
   * @returns The created profile document
   */
  async createDefaultProfile(userId: string): Promise<ProfileDocument> {
    logger.info(`Creating default personal profile for user ${userId}`);

    // Get user data
    const user = await User.findById(userId);
    if (!user) {
      throw createHttpError(404, 'User not found');
    }

    // Get the default personal profile template
    let template = await ProfileTemplate.findOne({
      profileType: 'personal',
      profileCategory: 'individual'
    });

    // If template doesn't exist, create it
    if (!template) {
      logger.info('Default personal profile template not found, creating one...');

      // Create a default admin ID (this is required by the schema)
      const adminId = new mongoose.Types.ObjectId();

      // Create the default personal profile template
      template = await ProfileTemplate.create({
        profileCategory: 'individual',
        profileType: 'personal',
        name: 'Personal Profile',
        slug: 'personal-profile',
        createdBy: adminId,
        categories: [
          {
            name: 'basic',
            label: 'Basic Information',
            icon: 'user',
            collapsible: true,
            fields: [
              {
                name: 'fullName',
                label: 'Full Name',
                widget: 'text',
                order: 1,
                enabled: true,
                required: true,
                placeholder: 'Enter your full name'
              },
              {
                name: 'bio',
                label: 'Bio',
                widget: 'textarea',
                order: 2,
                enabled: true,
                required: false,
                placeholder: 'Tell us about yourself'
              }
            ]
          },
          {
            name: 'contact',
            label: 'Contact Information',
            icon: 'phone',
            collapsible: true,
            fields: [
              {
                name: 'email',
                label: 'Email',
                widget: 'email',
                order: 1,
                enabled: true,
                required: false,
                placeholder: 'Enter your email'
              },
              {
                name: 'phone',
                label: 'Phone',
                widget: 'phone',
                order: 2,
                enabled: true,
                required: false,
                placeholder: 'Enter your phone number'
              }
            ]
          }
        ]
      });

      logger.info(`Created default personal profile template: ${template._id}`);
    }

    const templateId = template.toJSON()._id.toString();

    // Create the profile
    const profile = await this.createProfile(userId, templateId);

    // Initialize referral code for the new profile
    try {
      const { ProfileReferralService } = require('./profile-referral.service');
      await ProfileReferralService.initializeReferralCode(profile._id);
      logger.info(`Initialized referral code for profile: ${profile._id}`);
    } catch (error) {
      logger.error(`Error initializing referral code for profile ${profile._id}:`, error);
      // Don't throw the error to avoid disrupting the profile creation process
    }

    // Add profile to user's profiles array
    await User.findByIdAndUpdate(userId, {
      $addToSet: { profiles: profile._id }
    });

    // Create a referral record for the profile
    try {
      const { ProfileReferralService } = require('./profile-referral.service');
      await ProfileReferralService.getProfileReferral(profile._id);
      logger.info(`Created referral record for profile: ${profile._id}`);

      // Check if the user was referred (has a valid referral code)
      if (user.referralCode && typeof user.referralCode === 'string' && user.referralCode.trim() !== '') {
        try {
          // Validate the referral code
          const referringProfileId = await ProfileReferralService.validateReferralCode(user.referralCode);

          if (referringProfileId) {
            // Process the referral
            const referralProcessed = await ProfileReferralService.processReferral(profile._id, referringProfileId);

            if (referralProcessed) {
              logger.info(`Successfully processed referral for profile ${profile._id} with referral code ${user.referralCode}`);
            } else {
              logger.warn(`Failed to process referral for profile ${profile._id} with referral code ${user.referralCode}`);
            }
          } else {
            logger.info(`Referral code ${user.referralCode} is invalid or not found, skipping referral processing`);
          }
        } catch (referralError) {
          logger.error(`Error processing referral for profile ${profile._id}:`, referralError);
          // Don't throw the error to avoid disrupting the profile creation process
        }
      } else {
        logger.info(`No valid referral code found for user ${userId}, skipping referral processing`);
      }
    } catch (error) {
      logger.error(`Error creating referral record for profile ${profile._id}:`, error);
      // Don't throw the error to avoid disrupting the profile creation process
    }

    return profile;
  }
}
