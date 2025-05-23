import { ProfileModel as Profile, ProfileDocument } from '../models/profile.model';
import { isValidObjectId } from 'mongoose';
import createHttpError from 'http-errors';
import { logger } from '../utils/logger';
import { User } from '../models/User';
import { ProfileTemplate, ProfileType, ProfileCategory } from '../models/profiles/profile-template';
import { generateUniqueConnectLink, generateReferralCode, generateSecondaryId } from '../utils/crypto';
import mongoose from 'mongoose';
import { ITemplateField } from '../models/profiles/profile-template';
import { FieldWidget } from '../models/profiles/profile-template';
import geoip from 'geoip-lite';

export class ProfileService {

  /**
   * Creates a profile with content in one step
   * @param userId The user ID creating the profile
   * @param templateId The template ID to base the profile on
   * @param profileInformation Basic profile information
   * @param sections Optional sections with field values and enabled status
   * @param members Optional array of member IDs for group profiles
   * @param location Optional location information for the profile
   * @param ip Optional IP address for geolocation
   * @param groups Optional array of group IDs for group profiles
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
    }>,
    members?: string[],
    location?: {
      city?: string;
      stateOrProvince?: string;
      country?: string;
      coordinates?: {
        latitude: number;
        longitude: number;
      };
    },
    ip?: string,
    groups?: string[]
  ): Promise<ProfileDocument> {
    logger.info(`Creating profile with content for user ${userId} using template ${templateId}`);

    // Validate inputs
    if (!isValidObjectId(userId) || !isValidObjectId(templateId)) {
      throw createHttpError(400, 'Invalid user ID or template ID');
    }

    // Get the template
    const template = await ProfileTemplate.findById(templateId);
    if (!template) {
      throw createHttpError(404, 'Template not found');
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
      const existingProfile = await Profile.findOne({ secondaryId: id });
      return !existingProfile;
    });

    // Get user data
    const user = await User.findById(userId);
    if (!user) {
      throw createHttpError(404, 'User not found');
    }

    // Get user's location if not provided
    let profileLocation = location;
    if (!profileLocation) {
      profileLocation = {
        country: user.countryOfResidence
      };

      // Try to get coordinates from IP if available
      if (ip) {
        const geo = geoip.lookup(ip);
        if (geo) {
          profileLocation = {
            ...profileLocation,
            city: geo.city,
            stateOrProvince: geo.region,
            country: geo.country,
            coordinates: {
              latitude: geo.ll[0],
              longitude: geo.ll[1]
            }
          };
        }
      }
    }

    // Create initial sections from template
    const initialSections = template.categories.map(category => ({
      key: category.name,
      label: category.label || category.name,
      icon: category.icon || '',
      collapsible: category.collapsible !== false,
      fields: category.fields.map(field => ({
        key: field.name,
        label: field.label || field.name,
        widget: field.widget || 'text',
        required: field.required || false,
        placeholder: field.placeholder || '',
        enabled: field.enabled !== false,
        value: field.default || null,
        options: field.options || [],
        validation: field.validation || {}
      }))
    }));

    // Create the base profile
    const profile = new Profile({
      profileCategory: template.profileCategory,
      profileType: template.profileType,
      secondaryId,
      templatedId: template._id,
      profileInformation: {
        username: profileInformation.username || user.fullName || user.username || '',
        title: profileInformation.title || '',
        profileLink,
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
      profileLocation,
      sections: initialSections,
      members: [], // Initialize empty members array
      groups: [] // Initialize empty groups array
    }) as ProfileDocument & { members: mongoose.Types.ObjectId[]; groups: mongoose.Types.ObjectId[] };

    // Handle group profiles and members
    if (template.profileCategory === 'group' || template.profileType === 'group') {
      // Add the creator as a member by default
      profile.members = [new mongoose.Types.ObjectId(userId)];
      
      // Add any provided members from the members parameter
      if (members && members.length > 0) {
        const validMemberIds = members.filter(id => isValidObjectId(id));
        profile.members = [...profile.members, ...validMemberIds.map(id => new mongoose.Types.ObjectId(id))];
      }

      // Add any provided groups from the groups parameter
      if (groups && groups.length > 0) {
        const validGroupIds = groups.filter(id => isValidObjectId(id));
        profile.groups = validGroupIds.map(id => new mongoose.Types.ObjectId(id));
      }
    }

    // Apply provided sections data if available
    if (sections && sections.length > 0) {
      for (const providedSection of sections) {
        const profileSection = profile.sections.find(s => s.key === providedSection.key);
        if (profileSection) {
          for (const providedField of providedSection.fields) {
            const profileField = profileSection.fields.find(f => f.key === providedField.key);
            if (profileField) {
              profileField.value = providedField.value;
              profileField.enabled = providedField.enabled;
              
              // Special handling for members field in info section
              if (providedField.key === 'members' && Array.isArray(providedField.value)) {
                // Ensure the root members array includes all members from the sections
                providedField.value.forEach((memberId: string) => {
                  if (isValidObjectId(memberId)) {
                    const objectId = new mongoose.Types.ObjectId(memberId);
                    if (!profile.members.some(m => m.equals(objectId))) {
                      profile.members.push(objectId);
                    }
                  }
                });
              }

              // Special handling for groups field in info section
              if (providedField.key === 'groups' && Array.isArray(providedField.value)) {
                // Ensure the root groups array includes all groups from the sections
                providedField.value.forEach((groupId: string) => {
                  if (isValidObjectId(groupId)) {
                    const objectId = new mongoose.Types.ObjectId(groupId);
                    if (!profile.groups.some(g => g.equals(objectId))) {
                      profile.groups.push(objectId);
                    }
                  }
                });
              }
            }
          }
        }
      }
    }

    await profile.save();
    logger.info(`Profile with content created successfully: ${profile._id}`);
    return profile;
  }

  /**
   * Creates a new profile based on a template
   * @param userId The user ID creating the profile
   * @param templateId The template ID to base the profile on
   * @param members Array of member IDs
   * @returns The created profile document
   */
  async createProfile(
    userId: string,
    templateId: string,
    members: string[] = []
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
      const existingProfile = await Profile.findOne({ secondaryId: id });
      return !existingProfile;
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

    // Add members and groups fields to info section for group profiles
    if (template.profileCategory === 'group' || template.profileType === 'group') {
      const infoSection = initialSections.find(s => s.key === 'info');
      if (infoSection) {
        // Add members field if it doesn't exist
        if (!infoSection.fields.some(f => f.key === 'members')) {
          infoSection.fields.push({
            key: 'members',
            value: [],
            enabled: true
          });
        }
        // Add groups field if it doesn't exist
        if (!infoSection.fields.some(f => f.key === 'groups')) {
          infoSection.fields.push({
            key: 'groups',
            value: [],
            enabled: true
          });
        }
      }
    }

    // Get user data for profile username
    const user = await User.findById(userId);
    const profileUsername = user?.fullName || user?.username || '';

    // Create the profile with appropriate group/member handling
    const profile = new Profile({
      profileCategory: template.profileCategory,
      profileType: template.profileType,
      secondaryId,
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
      sections: initialSections,
      members: [] // Initialize empty members array
    });

    // Handle group profiles and members
    if (template.profileCategory === 'group' || template.profileType === 'group') {
      // Add the creator as a member
      profile.members = [new mongoose.Types.ObjectId(userId)];
      
      // If additional members are provided, add them
      if (members && members.length > 0) {
        const validMemberIds = members.filter(id => isValidObjectId(id));
        profile.members = [...profile.members, ...validMemberIds.map(id => new mongoose.Types.ObjectId(id))];
        
        // Also add to the members field in info section if it exists
        const infoSection = profile.sections.find(s => s.key === 'info');
        if (infoSection) {
          const membersField = infoSection.fields.find(f => f.key === 'members');
          if (membersField) {
            membersField.value = profile.members;
          }
        }
      }
    }

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

    const profile = await Profile.findById(profileId)
      .populate('profileInformation.creator', 'fullName email')
      .populate('members', 'profileInformation.username profileInformation.title _id')
      .populate('groups', 'profileInformation.username profileInformation.title _id');

    if (!profile) {
      throw createHttpError(404, 'Profile not found');
    }

    // Process sections to ensure all fields are properly enabled and have values
    profile.sections.forEach(section => {
      section.fields.forEach(field => {
        if (field.value === null && field.default) {
          field.value = field.default;
        }
      });
    });

    // Process members and groups if they exist
    if (profile.members && profile.members.length > 0) {
      const membersSection = profile.sections.find(s => s.key === 'info');
      if (membersSection) {
        const membersField = membersSection.fields.find(f => f.key === 'members');
        if (membersField) {
          membersField.value = profile.members.map(member => ({
            id: member._id,
            name: (member as any).profileInformation?.title || (member as any).profileInformation?.username
          }));
          membersField.enabled = true;
        }
      }
    }

    if (profile.groups && profile.groups.length > 0) {
      const groupsSection = profile.sections.find(s => s.key === 'info');
      if (groupsSection) {
        const groupsField = groupsSection.fields.find(f => f.key === 'groups');
        if (groupsField) {
          groupsField.value = profile.groups.map(group => ({
            id: group._id,
            name: (group as any).profileInformation?.title || (group as any).profileInformation?.username
          }));
          groupsField.enabled = true;
        }
      }
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

    if (profile.profileInformation.creator.toString() != userId) {
      console.log(` creator id ${profile.profileInformation.creator.toString()} user id ${userId}`);
      logger.warn(`User ${userId} does not have permission to delete profile ${profileId}`);
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

    const profiles = await Profile.find(filter)
      .select({
        'profileCategory': 1,
        'profileType': 1,
        'secondaryId': 1,
        'profileInformation': 1,
        'sections': 1,
        'members': 1,
        'groups': 1,
        'ProfileFormat': 1,
        'profileLocation': 1,
        'ProfileProducts': 1,
        'verificationStatus': 1,
        'ProfileMypts': 1,
        'ProfileReferal': 1,
        'ProfileBadges': 1,
        'analytics': 1,
        'availability': 1
      })
      .populate('profileInformation.creator', 'fullName email')
      .populate('members', 'profileInformation.username profileInformation.title _id')
      .populate('groups', 'profileInformation.username profileInformation.title _id')
      .sort({ 'profileInformation.createdAt': -1 })
      .skip(skip)
      .limit(limit);

    // Process profiles to ensure all required fields are present
    const processedProfiles = await Promise.all(profiles.map(async profile => {
      // Process sections to ensure all fields are properly enabled and have values
      profile.sections.forEach(section => {
        section.fields.forEach(field => {
          if (field.value === null && field.default) {
            field.value = field.default;
          }
        });
      });

      // Process members and groups if they exist
      if (profile.members && profile.members.length > 0) {
        const membersSection = profile.sections.find(s => s.key === 'info');
        if (membersSection) {
          const membersField = membersSection.fields.find(f => f.key === 'members');
          if (membersField) {
            membersField.value = profile.members.map(member => ({
              id: member._id,
              name: (member as any).profileInformation?.title || (member as any).profileInformation?.username
            }));
            membersField.enabled = true;
          } else {
            // Add members field if it doesn't exist
            membersSection.fields.push({
              key: 'members',
              label: 'Members',
              widget: 'multiselect',
              value: profile.members.map(member => ({
                id: member._id,
                name: (member as any).profileInformation?.title || (member as any).profileInformation?.username
              })),
              enabled: true
            });
          }
        }
      }

      if (profile.groups && profile.groups.length > 0) {
        const groupsSection = profile.sections.find(s => s.key === 'info');
        if (groupsSection) {
          const groupsField = groupsSection.fields.find(f => f.key === 'groups');
          if (groupsField) {
            groupsField.value = profile.groups.map(group => ({
              id: group._id,
              name: (group as any).profileInformation?.title || (group as any).profileInformation?.username
            }));
            groupsField.enabled = true;
          } else {
            // Add groups field if it doesn't exist
            groupsSection.fields.push({
              key: 'groups',
              label: 'Groups',
              widget: 'multiselect',
              value: profile.groups.map(group => ({
                id: group._id,
                name: (group as any).profileInformation?.title || (group as any).profileInformation?.username
              })),
              enabled: true
            });
          }
        }
      }

      return profile;
    }));

    return processedProfiles;
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

  /**
   * Set profile availability
   */
  async setAvailability(profileId: string, availabilityData: any): Promise<any> {
    const profile = await this.getProfile(profileId);
    if (!profile) {
      throw createHttpError(404, 'Profile not found');
    }

    // Convert profile to document to access methods
    const profileDoc = profile as ProfileDocument;
    profileDoc.availability = {
      ...profileDoc.availability,
      ...availabilityData,
      isAvailable: true
    };

    await profileDoc.save();
    return profileDoc.availability;
  }

  /**
   * Update profile availability
   */
  async updateAvailability(profileId: string, updates: any): Promise<any> {
    const profile = await this.getProfile(profileId);
    if (!profile) {
      throw createHttpError(404, 'Profile not found');
    }

    // Convert profile to document to access methods
    const profileDoc = profile as ProfileDocument;
    if (!profileDoc.availability) {
      profileDoc.availability = {
        isAvailable: true,
        defaultDuration: 60,
        bufferTime: 15,
        workingHours: {},
        exceptions: [],
        bookingWindow: {
          minNotice: 60,
          maxAdvance: 30
        },
        breakTime: []
      };
    }

    // Update specific fields
    if (updates.defaultDuration) profileDoc.availability.defaultDuration = updates.defaultDuration;
    if (updates.bufferTime) profileDoc.availability.bufferTime = updates.bufferTime;
    if (updates.workingHours) profileDoc.availability.workingHours = updates.workingHours;
    if (updates.exceptions) profileDoc.availability.exceptions = updates.exceptions;
    if (updates.bookingWindow) profileDoc.availability.bookingWindow = updates.bookingWindow;
    if (updates.breakTime) {
      // Ensure breakTime days are properly formatted strings
      profileDoc.availability.breakTime = updates.breakTime.map((breakTime: any) => ({
        start: breakTime.start,
        end: breakTime.end,
        days: breakTime.days.map((day: string) => day.charAt(0).toUpperCase() + day.slice(1).toLowerCase())
      }));
    }
    if (updates.isAvailable !== undefined) profileDoc.availability.isAvailable = updates.isAvailable;

    await profileDoc.save();
    return profileDoc.availability;
  }

  /**
   * Get profile availability
   */
  async getAvailability(profileId: string): Promise<any> {
    const profile = await this.getProfile(profileId);
    if (!profile) {
      throw createHttpError(404, 'Profile not found');
    }

    return profile.availability;
  }

  /**
   * Get available slots for a specific date
   */
  async getAvailableSlots(profileId: string, date: Date): Promise<Array<{start: Date, end: Date}>> {
    const profile = await this.getProfile(profileId);
    if (!profile) {
      throw new Error('Profile not found');
    }

    if (!profile.availability?.isAvailable) {
      console.log('Debug - Profile is not available');
      return [];
    }

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayOfWeek = dayNames[date.getDay()];
    
    // Handle both Map and object formats for workingHours
    const workingHours = profile.availability.workingHours instanceof Map 
      ? profile.availability.workingHours.get(dayOfWeek)
      : profile.availability.workingHours[dayOfWeek];
    console.log('Debug - Working hours:', workingHours);
    
    if (!workingHours?.isWorking) {
      console.log('Debug - Not a working day');
      return [];
    }

    const dateStr = date.toISOString().split('T')[0];
    const slots: Array<{start: Date, end: Date}> = [];

    // Check for exceptions
    const exception = profile.availability.exceptions?.find(e => 
      e.date.toISOString().split('T')[0] === dateStr
    );
    console.log('Debug - Exception found:', exception);

    if (exception) {
      if (!exception.isAvailable) {
        console.log('Debug - Exception marks day as unavailable');
        return [];
      }
      if (exception.slots) {
        console.log('Debug - Using exception slots');
        return exception.slots.map(slot => ({
          start: new Date(`${dateStr}T${slot.start}`),
          end: new Date(`${dateStr}T${slot.end}`)
        }));
      }
    }

    // Generate slots based on working hours and default duration
    const startTime = new Date(`${dateStr}T${workingHours.start}`);
    const endTime = new Date(`${dateStr}T${workingHours.end}`);
    const duration = profile.availability.defaultDuration;
    const buffer = profile.availability.bufferTime;

    console.log('Debug - Slot generation:', {
      startTime,
      endTime,
      duration,
      buffer
    });

    let currentTime = new Date(startTime);
    while (currentTime < endTime) {
      const slotEnd = new Date(currentTime.getTime() + duration * 60000);
      if (slotEnd <= endTime) {
        // Check if slot overlaps with break time
        const isInBreakTime = profile.availability.breakTime?.some(breakTime => {
          if (!breakTime.days.includes(dayOfWeek)) return false;
          const breakStart = new Date(`${dateStr}T${breakTime.start}`);
          const breakEnd = new Date(`${dateStr}T${breakTime.end}`);
          return (currentTime >= breakStart && currentTime < breakEnd) || 
                 (slotEnd > breakStart && slotEnd <= breakEnd);
        });

        if (!isInBreakTime) {
          slots.push({
            start: new Date(currentTime),
            end: new Date(slotEnd)
          });
        }
      }
      currentTime = new Date(currentTime.getTime() + (duration + buffer) * 60000);
    }

    return slots;
  }

  /**
   * Fetches community profiles with filters for location and other criteria
   * @param filters Object containing filter criteria (town, city, country, etc.)
   * @param skip Number of documents to skip
   * @param limit Maximum number of documents to return
   * @returns Array of community profile documents with minimal sections
   */
  async getCommunityProfiles(filters: {
    town?: string;
    city?: string;
    country?: string;
    groupId?: string;
    memberId?: string;
    keyword?: string;
    latitude?: number;
    longitude?: number;
    radius?: number; // in kilometers
    sortBy?: 'name' | 'createdAt' | 'members' | 'groups';
    sortOrder?: 'asc' | 'desc';
    [key: string]: any;
  }, skip = 0, limit = 20): Promise<ProfileDocument[]> {
    logger.info(`Fetching community profiles with filters: ${JSON.stringify(filters)}, skip: ${skip}, limit: ${limit}`);

    // Build the filter query
    const query: any = {
      profileCategory: 'group',
      profileType: 'community'
    };

    // Add location filters if provided
    if (filters.town || filters.city || filters.country) {
      query['profileLocation'] = { $exists: true, $ne: null };
      
      if (filters.city) {
        query['profileLocation.city'] = { 
          $exists: true,
          $ne: null,
          $regex: new RegExp(filters.city, 'i') 
        };
      }
      if (filters.country) {
        query['profileLocation.country'] = { 
          $exists: true,
          $ne: null,
          $regex: new RegExp(filters.country, 'i') 
        };
      }
      if (filters.town) {
        query['$or'] = [
          { 'profileLocation.city': { 
            $exists: true,
            $ne: null,
            $regex: new RegExp(filters.town, 'i') 
          }},
          { 'profileLocation.stateOrProvince': { 
            $exists: true,
            $ne: null,
            $regex: new RegExp(filters.town, 'i') 
          }}
        ];
      }

      // Log the location query for debugging
      logger.debug('Location query:', JSON.stringify(query['profileLocation']));
    }

    // Add group filter if provided
    if (filters.groupId) {
      query['groups'] = filters.groupId;
    }

    // Add member filter if provided
    if (filters.memberId) {
      query['members'] = filters.memberId;
    }

    // Add keyword search if provided
    if (filters.keyword) {
      query['$or'] = [
        { 'profileInformation.username': { $regex: new RegExp(filters.keyword, 'i') } },
        { 'profileInformation.title': { $regex: new RegExp(filters.keyword, 'i') } },
        { 'sections.fields.value': { $regex: new RegExp(filters.keyword, 'i') } },
        { 'profileLocation.city': { $regex: new RegExp(filters.keyword, 'i') } },
        { 'profileLocation.stateOrProvince': { $regex: new RegExp(filters.keyword, 'i') } },
        { 'profileLocation.country': { $regex: new RegExp(filters.keyword, 'i') } }
      ];
    }

    // Add geospatial query if coordinates and radius are provided
    if (filters.latitude && filters.longitude && filters.radius) {
      query['profileLocation.coordinates'] = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [filters.longitude, filters.latitude]
          },
          $maxDistance: filters.radius * 1000 // Convert km to meters
        }
      };
    }

    // Log the final query for debugging
    logger.debug('Final query:', JSON.stringify(query));

    // Determine sort options
    const sort: any = {};
    if (filters.sortBy) {
      switch (filters.sortBy) {
        case 'name':
          sort['profileInformation.username'] = filters.sortOrder === 'desc' ? -1 : 1;
          break;
        case 'createdAt':
          sort['profileInformation.createdAt'] = filters.sortOrder === 'desc' ? -1 : 1;
          break;
        case 'members':
          sort['members'] = filters.sortOrder === 'desc' ? -1 : 1;
          break;
        case 'groups':
          sort['groups'] = filters.sortOrder === 'desc' ? -1 : 1;
          break;
        default:
          sort['profileInformation.createdAt'] = -1; // Default sort by creation date
      }
    } else {
      sort['profileInformation.createdAt'] = -1; // Default sort by creation date
    }

    // Fetch profiles with all fields
    const profiles = await Profile.find(query)
      .select({
        'profileInformation': 1,
        'sections': 1,
        'profileLocation': 1,
        'members': 1,
        'groups': 1
      })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('profileInformation.creator', 'fullName email')
      .populate('members', 'profileInformation.username profileInformation.title _id')
      .populate('groups', 'profileInformation.username profileInformation.title _id');

    // Log the number of profiles found
    logger.debug(`Found ${profiles.length} profiles matching the query`);

    // Process profiles to ensure all required fields are present
    const processedProfiles = await Promise.all(profiles.map(async profile => {
      // Log profile location for debugging
      logger.debug(`Profile ${profile._id} location:`, JSON.stringify(profile.profileLocation));

      const infoSection = profile.sections.find(s => s.key === 'info');
      if (infoSection) {
        // Ensure community_name field exists and has a value
        const communityNameField = infoSection.fields.find(f => f.key === 'community_name');
        if (!communityNameField) {
          const communityNameField = {
            key: 'community_name',
            label: 'Community Name',
            widget: 'text' as FieldWidget,
            enabled: true,
            value: profile.profileInformation.title || profile.profileInformation.username
          } as any;
          infoSection.fields.push(communityNameField);
        } else {
          (communityNameField as any).value = profile.profileInformation.title || profile.profileInformation.username;
          communityNameField.enabled = true;
        }

        // Process members and groups fields
        for (const field of infoSection.fields) {
          if (field.key === 'members' || field.key === 'groups') {
            const memberIds = (field as any).value || [];
            if (Array.isArray(memberIds)) {
              const members = await Profile.find({ _id: { $in: memberIds } })
                .select('profileInformation.username profileInformation.title _id');
              
              (field as any).value = members.map(member => ({
                id: member._id,
                name: (member as any).profileInformation?.title || (member as any).profileInformation?.username
              }));
            }
          } else if ((field as any).value === null && field.default) {
            (field as any).value = field.default;
          }
        }
      }
      return profile;
    }));

    return processedProfiles;
  }
}
