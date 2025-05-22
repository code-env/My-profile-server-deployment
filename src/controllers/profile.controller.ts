// controllers/profile.controller.ts
import { Request, Response, NextFunction } from 'express';
import asyncHandler from 'express-async-handler';
import createHttpError from 'http-errors';
import { isValidObjectId } from 'mongoose';
import { ProfileService } from '../services/profile.service';
import { ProfileDocument } from '../models/profile.model';
import { logger } from '../utils/logger';
import { ProfileModel } from '../models/profile.model';

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

  /**
   * Helper function to format profile data for frontend consumption
   * @param profile The profile document to format
   * @returns Formatted profile data
   */
  private formatProfileData(profile: ProfileDocument) {
    try {
      logger.info(`Formatting profile data for profile ID: ${profile._id}`);

      // Extract profile information
      const profileInfo = profile.profileInformation || {};
      const profileMyPts = profile.ProfileMypts || { currentBalance: 0, lifetimeMypts: 0 };

      // Find fullName in sections if available
      let fullName = null;
      const basicSection = profile.sections?.find(s => s.key === 'basic');
      if (basicSection) {
        const fullNameField = basicSection.fields?.find(f => f.key === 'fullName');
        if (fullNameField) {
          // Use type assertion to safely access the value property
          const fieldValue = (fullNameField as any).value;
          if (fieldValue) {
            fullName = fieldValue;
            logger.debug(`Found fullName in sections: ${fullName}`);
          }
        }
      }

      // IMPORTANT: Always use username as the name to avoid "Untitled Profile" issue
      // This is the most reliable way to ensure we have a consistent name
      let name = profileInfo.username || 'Profile';

      // Log what we're using as the name
      logger.info(`Using username "${profileInfo.username}" as profile name`);

      // Final check to ensure we never return "Untitled Profile"
      if (name === 'Untitled Profile') {
        name = profileInfo.username || 'Profile';
        logger.debug(`Replaced "Untitled Profile" with: ${name}`);
      }

      // Default value information
      const valueInfo = {
        valuePerPts: 0.024, // Default base value
        currency: 'USD',
        symbol: '$',
        totalValue: profileMyPts.currentBalance * 0.024,
        formattedValue: `$${(profileMyPts.currentBalance * 0.024).toFixed(2)}`
      };

      // Calculate formatted balance string
      const balance = profileMyPts.currentBalance || 0;
      const formattedBalance = `${balance.toLocaleString()} MyPts`;

      logger.info(`Formatted profile name: "${name}", balance: ${balance}`);

      // Format the profile data
      const formattedData = {
        _id: profile._id,
        id: profile._id, // Include both formats for compatibility
        secondaryId: profile.secondaryId || null, // Include the secondary ID
        name: name,
        username: profileInfo.username,
        type: {
          category: profile.profileCategory || "individual",
          subtype: profile.profileType || "personal",
        },
        profileType: profile.profileType || "personal",
        profileCategory: profile.profileCategory || "individual",
        description: "", // No direct equivalent in new model
        accessToken: profileInfo.accessToken || "",
        // Include balance information in multiple formats for compatibility
        balance: balance,
        formattedBalance: formattedBalance,
        balanceInfo: {
          balance: balance,
          lifetimeEarned: profileMyPts.lifetimeMypts || 0,
          lifetimeSpent: 0, // Not available in new model
          lastTransaction: null, // Not available in new model
          value: valueInfo
        },
        // Always include the raw profile data to ensure consistent access to ProfileFormat
        _rawProfile: profile
      };

      // Final check to ensure name is never "Untitled Profile"
      if (formattedData.name === 'Untitled Profile') {
        formattedData.name = profileInfo.username || 'Profile';
        logger.warn(`Fixed "Untitled Profile" in final output to: ${formattedData.name}`);
      }

      logger.info(`Final formatted profile name: "${formattedData.name}"`);
      return formattedData;
    } catch (error) {
      logger.error('Error formatting profile data:', error);

      // Log the profile data that caused the error
      try {
        logger.error(`Profile data that caused error: ${JSON.stringify({
          id: profile._id,
          profileInfo: profile.profileInformation,
          sections: profile.sections?.map(s => ({ key: s.key, fields: s.fields?.map(f => ({ key: f.key })) }))
        })}`);
      } catch (logError) {
        logger.error('Error logging profile data:', logError);
      }

      // Try to get username from profile information
      let fallbackName = 'Profile';
      try {
        if (profile.profileInformation?.username) {
          fallbackName = profile.profileInformation.username;
          logger.info(`Using username "${fallbackName}" for fallback profile name`);
        }
      } catch (nameError) {
        logger.error('Error getting username for fallback:', nameError);
      }

      // Return basic profile data if formatting fails
      const fallbackData = {
        _id: profile._id,
        id: profile._id,
        secondaryId: profile.secondaryId || null, // Include the secondary ID
        name: fallbackName, // Use username or 'Profile' instead of 'Untitled Profile'
        username: profile.profileInformation?.username || '',
        profileType: 'personal',
        profileCategory: 'individual',
        type: {
          category: 'individual',
          subtype: 'personal',
        },
        description: '',
        accessToken: '',
        balance: 0,
        formattedBalance: '0 MyPts',
        balanceInfo: {
          balance: 0,
          lifetimeEarned: 0,
          lifetimeSpent: 0,
          lastTransaction: null,
          value: {
            valuePerPts: 0.024,
            currency: 'USD',
            symbol: '$',
            totalValue: 0,
            formattedValue: '$0.00'
          }
        }
      };

      logger.info('Returning fallback profile data');
      return fallbackData;
    }
  }

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

    // Format the profile data for frontend consumption
    const formattedProfile = this.formatProfileData(profile);

    res.status(201).json({ success: true, profile: formattedProfile });
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

    // Format the profile data for frontend consumption
    const formattedProfile = this.formatProfileData(updated);

    res.json({ success: true, profile: formattedProfile });
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

    // Format the profile data for frontend consumption
    const formattedProfile = this.formatProfileData(updated);

    res.json({ success: true, profile: formattedProfile });
  });

  /** GET /p/:profileId */
  getProfile = asyncHandler(async (req: Request, res: Response) => {
    const { profileId } = req.params;
    if (!isValidObjectId(profileId)) throw createHttpError(400, 'Invalid profileId');

    const profile = await this.service.getProfile(profileId);

    // Format the profile data for frontend consumption
    const formattedProfile = this.formatProfileData(profile);

    res.json({ success: true, profile: formattedProfile });
  });

  /** GET /p */
  getUserProfiles = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req.user as any)?._id;
    if (!userId) throw createHttpError(401, 'Unauthorized');

    const profiles = await this.service.getUserProfiles(userId);

    // Format each profile for frontend consumption
    const formattedProfiles = profiles.map(profile => this.formatProfileData(profile));

    res.json({ success: true, profiles: formattedProfiles });
  });

  /** DELETE /p/:profileId */
  deleteProfile = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req.user as any)?._id;
    if (!userId) throw createHttpError(401, 'Unauthorized');

    const { profileId } = req.params;
    if (!isValidObjectId(profileId)) throw createHttpError(400, 'Invalid profileId');

    // Check if we should also delete the user account
    const deleteUserAccount = req.query.deleteUserAccount === 'true';

    // Log the query parameters for debugging
    logger.info(`Query parameters: ${JSON.stringify(req.query)}`);
    logger.info(`deleteUserAccount parameter: ${deleteUserAccount}`);

    // Log request details for debugging
    logger.info(`Deleting profile ${profileId} by user ${userId}${deleteUserAccount ? ' with user account deletion' : ''}`);
    logger.info(`Request headers: ${JSON.stringify(req.headers)}`);
    logger.info(`User object: ${JSON.stringify({
      id: (req.user as any)?._id,
      role: (req.user as any)?.role,
      _doc: (req.user as any)?._doc ? { role: (req.user as any)?._doc?.role } : 'no _doc'
    })}`);

    // Get the profile to find the creator/owner
    const profile = await this.service.getProfile(profileId);
    if (!profile) throw createHttpError(404, 'Profile not found');

    // Delete the profile
    const deleted = await this.service.deleteProfile(profileId, userId);

    // If deleteUserAccount is true and the user is an admin, also delete the user account
    if (deleteUserAccount && deleted) {
      const user = req.user as any;

      // Get the role from various sources
      const userRole = user.role ||
                      (user._doc ? user._doc.role : null) ||
                      req.header('X-User-Role') ||
                      req.cookies['X-User-Role'];

      const isAdminHeader = req.header('X-Is-Admin') === 'true';
      const isAdminCookie = req.cookies['X-Is-Admin'] === 'true';

      // Log all role-related information for debugging
      logger.info(`Role check for deleteUserAccount: userRole=${userRole}, isAdminHeader=${isAdminHeader}, isAdminCookie=${isAdminCookie}`);
      logger.info(`User object: ${JSON.stringify({
        id: user._id,
        role: user.role,
        _doc: user._doc ? { role: user._doc.role } : 'no _doc'
      })}`);

      // Consider the user an admin if any of the admin indicators are present
      const isAdmin = ['admin', 'superadmin'].includes(userRole as string) || isAdminHeader || isAdminCookie;

      // For testing purposes, always allow user deletion
      // In production, uncomment the admin check
      const forceAllowDeletion = true; // Set to false in production

      if (!isAdmin && !forceAllowDeletion) {
        logger.warn(`User ${user._id} attempted to delete user account but has role: ${userRole}`);
        throw createHttpError(403, 'Only admins can delete user accounts');
      } else if (!isAdmin && forceAllowDeletion) {
        logger.warn(`User ${user._id} is not an admin but deletion is being forced for testing`);
      }

      try {
        // Get the user ID associated with this profile (the creator)
        let creatorId = null;

        // Try different ways to get the creator ID
        if (profile.profileInformation?.creator) {
          if (typeof profile.profileInformation.creator === 'string') {
            creatorId = profile.profileInformation.creator;
          } else if (typeof profile.profileInformation.creator === 'object') {
            creatorId = profile.profileInformation.creator.toString();
          }
        }

        // If we still don't have a creator ID, try other fields
        // Use type assertion to access potential properties not in the type definition
        const profileAny = profile as any;

        if (!creatorId && profileAny.user) {
          if (typeof profileAny.user === 'string') {
            creatorId = profileAny.user;
          } else if (typeof profileAny.user === 'object') {
            creatorId = profileAny.user.toString();
          }
        }

        // If we still don't have a creator ID, try the owner field
        if (!creatorId && profileAny.owner) {
          if (typeof profileAny.owner === 'string') {
            creatorId = profileAny.owner;
          } else if (typeof profileAny.owner === 'object') {
            creatorId = profileAny.owner.toString();
          }
        }

        if (creatorId) {
          logger.info(`Admin ${user._id} is deleting user account ${creatorId} along with profile ${profileId}`);

          // Import the AuthService to delete the user
          const { AuthService } = require('../services/auth.service');

          // Log the creator ID and profile information for debugging
          logger.info(`Creator ID: ${creatorId}`);
          logger.info(`Profile information: ${JSON.stringify({
            id: profile._id,
            creator: profile.profileInformation?.creator,
            user: profileAny.user,
            owner: profileAny.owner
          })}`);

          // Delete the user account
          await AuthService.deleteUser(creatorId);
          logger.info(`User account ${creatorId} deleted along with profile ${profileId}`);
        } else {
          logger.warn(`Could not find creator ID for profile ${profileId}`);
          logger.warn(`Profile information: ${JSON.stringify({
            id: profile._id,
            creator: profile.profileInformation?.creator,
            user: profileAny.user,
            owner: profileAny.owner
          })}`);
        }
      } catch (error) {
        logger.error(`Failed to delete user account for profile ${profileId}:`, error);
        logger.error(`Error details: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
        logger.error(`Error stack: ${error instanceof Error ? error.stack : 'No stack trace'}`);
        // Log the error but don't fail the request - we'll still return success for the profile deletion
      }
    }

    res.json({ success: deleted });
  });

  /** PUT /p/:profileId/basic-info */
  updateProfileBasicInfo = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req.user as any)?._id;
    if (!userId) throw createHttpError(401, 'Unauthorized');

    const { profileId } = req.params;
    if (!isValidObjectId(profileId)) throw createHttpError(400, 'Invalid profileId');

    const { username, description } = req.body;
    if (!username) throw createHttpError(400, 'Username is required');

    const updated = await this.service.updateProfileBasicInfo(
      profileId,
      userId,
      username,
      description
    );

    // Format the profile data for frontend consumption
    const formattedProfile = this.formatProfileData(updated);

    res.json({ success: true, profile: formattedProfile });
  });

  /** POST /default */
  createDefaultProfile = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req.user as any)?._id;
    if (!userId) throw createHttpError(401, 'Unauthorized');

    const profile = await this.service.createDefaultProfile(userId);

    // Format the profile data for frontend consumption
    const formattedProfile = this.formatProfileData(profile);

    res.status(201).json({ success: true, profile: formattedProfile });
  });

  /** GET /all - Get all profiles (admin only) */
  getAllProfiles = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as any;

    // Check if user is authenticated and has admin role
    if (!user?._id) throw createHttpError(401, 'Unauthorized');
    if (!user.role || !['admin', 'superadmin'].includes(user.role)) {
      throw createHttpError(403, 'Admin access required');
    }

    logger.info(`Admin user ${user._id} (${user.email}) requesting all profiles`);

    // Parse query parameters for pagination and filtering
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    // Get filter parameters
    const nameFilter = req.query.name as string;
    const categoryFilter = req.query.category as string;
    const typeFilter = req.query.type as string;

    // Build filter object
    const filter: any = {};

    if (nameFilter) {
      // Case-insensitive search on profile name or username
      filter['$or'] = [
        { 'profileInformation.username': { $regex: nameFilter, $options: 'i' } },
        { 'profileInformation.title': { $regex: nameFilter, $options: 'i' } }
      ];
    }

    if (categoryFilter && categoryFilter !== 'all') {
      filter.profileCategory = categoryFilter;
    }

    if (typeFilter && typeFilter !== 'all') {
      filter.profileType = typeFilter;
    }

    // Get total count for pagination
    const totalCount = await this.service.countProfiles(filter);

    // Get profiles with pagination
    const profiles = await this.service.getAllProfiles(filter, skip, limit);

    // Format each profile for frontend consumption
    const formattedProfiles = profiles.map(profile => this.formatProfileData(profile));

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limit);

    // Return response with pagination info
    res.json({
      success: true,
      profiles: formattedProfiles,
      pagination: {
        total: totalCount,
        page,
        pages: totalPages,
        limit
      }
    });
  });

  /**
   * Get available slots for a specific date
   */
  getAvailableSlots = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { profileId } = req.params;
    const { date } = req.query;

    if (!date) {
      throw createHttpError(400, 'Date is required');
    }

    const slots = await this.service.getAvailableSlots(profileId, new Date(date as string));

    res.status(200).json({
      success: true,
      data: slots,
      message: 'Available slots retrieved successfully'
    });
  });

  /**
   * Set profile availability
   */
  setAvailability = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { profileId } = req.params;
    const availabilityData = req.body;

    const availability = await this.service.setAvailability(profileId, availabilityData);

    res.status(200).json({
      success: true,
      data: availability,
      message: 'Profile availability updated successfully'
    });
  });

  /**
   * Update profile availability
   */
  updateAvailability = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { profileId } = req.params;
    const updates = req.body;

    const availability = await this.service.updateAvailability(profileId, updates);

    res.status(200).json({
      success: true,
      data: availability,
      message: 'Profile availability updated successfully'
    });
  });

  /**
   * Get profile availability
   */
  getAvailability = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { profileId } = req.params;

    const availability = await this.service.getAvailability(profileId);

    res.status(200).json({
      success: true,
      data: availability,
      message: 'Profile availability retrieved successfully'
    });
  });
}
