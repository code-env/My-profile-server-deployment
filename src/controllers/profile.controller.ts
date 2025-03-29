import { Request, Response } from 'express';
import { ProfileModel, PersonalProfile, BusinessProfile, MedicalProfile, AcademicProfile } from '../models/profile.model';
import { User } from '../models/User';
import { logger } from '../utils/logger';
import { isValidObjectId, Types } from 'mongoose';
import createHttpError from 'http-errors';
import asyncHandler from 'express-async-handler';
import { ProfileService } from '../services/profile.service';
import { PersonalInfo, ContactInfo, SocialInfo } from '../types/profile.types';
import mongoose from 'mongoose';
import { updateUserToAdmin } from '../middleware/roleMiddleware';

interface RequestUser {
  _id: mongoose.Types.ObjectId;
  role?: string;
  subscription?: {
    limitations: {
      maxProfiles: number;
    };
  };
}

const profileService = new ProfileService();

// @desc    Create a new profile
// @route   POST /api/profiles
// @access  Private
export const createProfile = asyncHandler(async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    // const user = {
    //   "_id":"67e41de4bc8ce32407f11e1c",
    //   "role":"user",
    //   "token":"dfudiufhdifuhdiu.ggndiufdhiufhidf.dffdjhbdjhbj"
    // }

    
    // Check user's subscription limits
    const userDoc = await User.findById(user._id).populate('profiles');
    if (!userDoc) {
      throw createHttpError(404, 'User not found');
    }

    // if (userDoc.profiles.length >= (userDoc.subscription?.limitations?.maxProfiles || Infinity) && user.role !== 'superadmin') {
    //   throw createHttpError(400, 'Profile limit reached for your subscription');
    // }

    const {
      name,
      description,
      type,
      role,
      details,
      categories,
      format,
      settings,
      forClaim
    } = req.body;

    // Validate required fields
    if (!name || !type || !type.category || !type.subtype) {
      throw createHttpError(400, 'Please provide name, type category, and subtype');
    }

    // Validate profile type
    const validsubTypes = ['personal', 'business', 'academic', 'medical'];
    const validCategory = ["individual", "functional", "group"]

    if (!validsubTypes.includes(type.subtype.toLowerCase())) {
      throw createHttpError(400, `Profile type must be one of: Personal, Business, Academic, Medical`);
    }
    if (!validCategory.includes(type.category.toLowerCase())) {
      throw createHttpError(400, `Profile category must be one of: Individual, Functional, Group`);
    }

    // Generate unique connect link
    const connectLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/connect/${Math.random().toString(36).substring(2, 15)}`;

    // Generate claim phrase if profile is for claiming
    const claimPhrase = forClaim ? generateClaimPhrase() : undefined;

    // Create base profile data
    const profileData = {
      name,
      description: description || '',
      type,
      role: role || 'Owner',
      profileCategory:type.category.toLocaleLowerCase(),
      details,
      owner: user._id,
      managers: [user._id],
      connectLink,
      claimed: !forClaim,
      claimPhrase,
      categories: categories || {
        about: { enabled: true },
        contact: { enabled: true },
        social: { enabled: true }
      },
      format: format || {
        cardImage: { type: 'default' },
        logo: { enabled: false },
        layout: 'default'
      },
      settings: {
        visibility: settings?.visibility || 'public',
        allowComments: settings?.allowComments ?? true,
        allowMessages: settings?.allowMessages ?? true,
        autoAcceptConnections: settings?.autoAcceptConnections ?? false
      },
      completion: 0,
      isActive: true
    };

    // Create profile using discriminator
    let profile;
    switch (type.subtype) {
      case 'personal':
      case 'Personal':
        profile = await PersonalProfile.create(profileData);
        break;
      case 'business':
      case 'Business':
        profile = await BusinessProfile.create(profileData);
        break;
      case 'academic':
      case 'Academic':
        profile = await AcademicProfile.create(profileData);
        break;
      case 'medical':
      case 'Medical':
        profile = await MedicalProfile.create(profileData);
        break;
      default:
        throw createHttpError(400, 'Invalid profile type');
    }

    // Add profile to user's profiles
    userDoc.profiles.push(profile._id as mongoose.Types.ObjectId);
    await userDoc.save();

    // Check if user should be promoted to admin
    if (userDoc.profiles.length > 10) {
      await updateUserToAdmin(user._id);
    }

    logger.info(`Profile created: ${profile._id} by user: ${user._id}`);
    res.status(201).json({
      success: true,
      message: forClaim ? 'Profile created and ready for claiming' : 'Profile created successfully',
      profile: {
        ...profile.toJSON(),
        claimPhrase: forClaim ? claimPhrase : undefined
      }
    });
  } catch (error) {
    logger.error('Profile creation error:', error);

    // More detailed error handling
    if (error instanceof mongoose.Error.ValidationError) {
      const errorMessages = Object.values(error.errors).map(err => err.message);
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errorMessages
      });
    } else if (createHttpError.isHttpError(error)) {
      res.status((error as createHttpError.HttpError).status).json({
        success: false,
        message: (error as createHttpError.HttpError).message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'An unexpected error occurred during profile creation',
        errorDetails: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

// Helper function to generate a claim phrase
function generateClaimPhrase(): string {
  const words = ['apple', 'banana', 'cherry', 'date', 'elderberry', 'fig', 'grape', 'honeydew'];
  const numbers = Math.floor(1000 + Math.random() * 9000); // 4-digit number
  const word1 = words[Math.floor(Math.random() * words.length)];
  const word2 = words[Math.floor(Math.random() * words.length)];
  return `${word1}-${word2}-${numbers}`;
}

// Helper function to generate a secure claim phrase
const generateSecureClaimPhrase = (): string => {
  // Generate a random 6-word phrase using common words
  const words = [
    'apple', 'banana', 'orange', 'grape', 'lemon', 'mango',
    'blue', 'red', 'green', 'yellow', 'purple', 'pink',
    'cat', 'dog', 'bird', 'fish', 'rabbit', 'horse',
    'sun', 'moon', 'star', 'cloud', 'rain', 'snow'
  ];
  const selectedWords = Array.from({ length: 6 }, () =>
    words[Math.floor(Math.random() * words.length)]
  );
  return selectedWords.join('-');
};


//   let result: Record<string, any> = {};
//   for (const key in obj) {
//     if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
//     const value = obj[key];
//     const newKey = prefix ? `${prefix}.${key}` : key;
//     if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
//       Object.assign(result, buildUpdateQuery(value, newKey));
//     } else {
//       result[newKey] = value;
//     }
//   }
//   console.log("result here:", result)
//   return result;
// }



// @desc    Create a profile for claiming
// @route   POST /api/profiles/create-claimable
// @access  Private
export const createClaimableProfile = asyncHandler(async (req: Request, res: Response) => {
  try {
    const user = req.user as RequestUser;
    const { name, description, profileType } = req.body;

    // Validate required fields
    if (!name || !profileType) {
      throw createHttpError(400, 'Please provide name and profile type');
    }

    // Generate a unique claim phrase
    const claimPhrase = generateSecureClaimPhrase();

    // Set claim expiration (48 hours from creation)
    const claimExpiresAt = new Date();
    claimExpiresAt.setHours(claimExpiresAt.getHours() + 48);

    // Create the profile
    const profile = await ProfileModel.create({
      name,
      description,
      profileType,
      owner: user._id, // Current user is temporary owner
      claimPhrase,
      claimed: false,
      claimExpiresAt,
      settings: {
        visibility: 'private',
        allowComments: false,
        allowMessages: false,
        autoAcceptConnections: false,
        emailNotifications: {
          connections: true,
          messages: true,
          comments: true,
          mentions: true,
          updates: true
        }
      }
    });

    logger.info(`Claimable profile created: ${profile._id} by user: ${user._id}`);

    // Return the claim phrase securely
    res.status(201).json({
      success: true,
      message: 'Profile created and ready for claiming',
      profile: {
        _id: profile._id,
        name: profile.name,
        claimPhrase,
        claimExpiresAt
      }
    });
  } catch (error) {
    logger.error('Error creating claimable profile:', error);
    throw error;
  }
});

// @desc    Claim a profile using claim phrase
// @route   POST /api/profiles/claim
// @access  Private
export const claimProfile = asyncHandler(async (req: Request, res: Response) => {
  try {
    const user = req.user as RequestUser;
    const { claimPhrase } = req.body;

    if (!claimPhrase) {
      throw createHttpError(400, 'Please provide the claim phrase');
    }

    // Find the profile with the given claim phrase
    const profile = await ProfileModel.findOne({
      claimPhrase,
      claimed: false,
      claimExpiresAt: { $gt: new Date() } // Check if claim hasn't expired
    });

    if (!profile) {
      throw createHttpError(404, 'Invalid or expired claim phrase');
    }

    // Update profile ownership
    profile.claimed = true;
    profile.claimedBy = user._id;
    profile.claimedAt = new Date();
    profile.owner = user._id;
    profile.managers = [user._id];
    profile.claimPhrase = undefined; // Remove claim phrase after successful claim

    // Update settings for the new owner
    profile.settings = {
      ...profile.settings,
      visibility: 'public',
      allowComments: true,
      allowMessages: true,
      autoAcceptConnections: false,
      emailNotifications: {
        connections: true,
        messages: true,
        comments: true,
        mentions: true,
        updates: true
      }
    };

    await profile.save();

    // Add profile to user's profiles
    await User.findByIdAndUpdate(user._id, {
      $addToSet: { profiles: profile._id }
    });

    logger.info(`Profile ${profile._id} claimed by user: ${user._id}`);

    res.status(200).json({
      success: true,
      message: 'Profile claimed successfully',
      profile: {
        _id: profile._id,
        name: profile.name,
        owner: profile.owner
      }
    });
  } catch (error) {
    logger.error('Error claiming profile:', error);
    throw error;
  }
});

// @desc    Update profile personal info
// @route   PUT /api/profiles/:id/personal-info
// @access  Private
export const updatePersonalInfo = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const personalInfo: Partial<PersonalInfo> = req.body;

  const updatedProfile = await profileService.updatePersonalInfo(user._id, personalInfo);
  if (!updatedProfile) {
    throw createHttpError(404, 'Profile not found');
  }

  res.json(updatedProfile);
});

// @desc    Update profile contact info
// @route   PUT /api/profiles/:id/contact-info
// @access  Private
export const updateContactInfo = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const contactInfo: Partial<ContactInfo> = req.body;

  const updatedProfile = await profileService.updateContactInfo(user._id, contactInfo);
  if (!updatedProfile) {
    throw createHttpError(404, 'Profile not found');
  }

  res.json(updatedProfile);
});

// @desc    Update profile social info
// @route   PUT /api/profiles/:id/social-info
// @access  Private
export const updateSocialInfo = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const socialInfo: Partial<SocialInfo> = req.body;

  const updatedProfile = await profileService.updateSocialInfo(user._id, socialInfo);
  if (!updatedProfile) {
    throw createHttpError(404, 'Profile not found');
  }

  res.json(updatedProfile);
});

// @desc    Get profile information
// @route   GET /api/profiles/:id
// @access  Private
export const getProfileInfo = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // const user = req.user as RequestUser; 
    const user = {
      "_id":"67deb94fd0eac9122a27148b",
      "role":"user",
      "token":"dfudiufhdifuhdiu.ggndiufdhiufhidf.dffdjhbdjhbj"
    }
    // Validate ObjectId
    if (!isValidObjectId(id)) {
      logger.warn(`Invalid profile ID: ${id}`);
      throw createHttpError(400, 'Invalid profile ID');
    }

    // Find profile with detailed logging
    const profile = await ProfileModel.findById(id);

    if (!profile) {
      logger.warn(`Profile not found: ${id}`);
      throw createHttpError(404, 'Profile not found');
    }

    // Optional: Add additional permission checks if needed
    const isOwner = profile.owner?.toString() === user._id.toString();
    const isManager = profile.managers.some(manager => manager.toString() === user._id.toString());

    if (!isOwner && !isManager && profile.settings.visibility !== 'public') {
      logger.warn(`Unauthorized profile access attempt: ${id} by user ${user._id}`);
      throw createHttpError(403, 'You do not have permission to view this profile');
    }

    // Remove sensitive information before sending
    const profileResponse = profile.toJSON();
    delete profileResponse.claimPhrase;

    res.status(200).json({
      success: true,
      profile: profileResponse
    });
  } catch (error) {
    logger.error('Profile retrieval error:', error);

    // More detailed error response
    if (error instanceof mongoose.Error.CastError) {
      res.status(400).json({
        success: false,
        message: 'Invalid profile ID format',
        code: 'INVALID_ID'
      });
    } else if (createHttpError.isHttpError(error)) {
      res.status(error.status).json({
        success: false,
        message: error.message,
        code: error.code || 'UNKNOWN_ERROR'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'An unexpected error occurred during profile retrieval',
        code: 'INTERNAL_SERVER_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

// @desc    Update a profile
// @route   PUT /api/profiles/:id
// @access  Private
export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = req.body;

  // Validate profile ID
  if (!isValidObjectId(id)) {
    throw createHttpError(400, 'Invalid profile ID');
  }

  // Find profile and check permissions
  const profile = await ProfileModel.findById(id);
  if (!profile) {
    throw createHttpError(404, 'Profile not found');
  }

  // Check if user has permission to update
  const user = req.user as RequestUser;
  if (!profile.managers.includes(user._id) && !profile.owner.equals(user._id) && user.role !== 'superadmin') {
    throw createHttpError(403, 'You do not have permission to update this profile');
  }

  // Remove protected fields from updates
  delete updates.owner;
  delete updates.managers;
  delete updates.claimed;
  delete updates.claimedBy;
  delete updates.qrCode;

  // Update profile
  const updatedProfile = await ProfileModel.findByIdAndUpdate(
    id,
    { $set: updates },
    { new: true, runValidators: true }
  );

  logger.info(`Profile updated: ${id} by user: ${user._id}`);
  res.json(updatedProfile);
});


// export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
//   const { id } = req.params;
//   const updates = req.body;
//   const user =  {
//     _id:"67deb94fd0eac9122a27148b",
//     role:"user",
//     token:"dfudiufhdifuhdiu.ggndiufdhiufhidf.dffdjhbdjhbj"
//   }

//   // Validate profile ID
//   if (!isValidObjectId(id)) {
//     throw createHttpError(400, 'Invalid profile ID');
//   }

//   // Find profile and check permissions
//   const profile = await ProfileModel.findById(id);
//   if (!profile) {
//     throw createHttpError(404, 'Profile not found');
//   }

//   // const user = req.user as RequestUser;
//   // if (!profile.managers.includes(user._id) && !profile.owner.equals(user._id) && user.role !== 'superadmin') {
//   //   throw createHttpError(403, 'You do not have permission to update this profile');
//   // }

//   // Remove protected fields from updates
//   delete updates.owner;
//   delete updates.managers;
//   delete updates.claimed;
//   delete updates.claimedBy;
//   delete updates.qrCode;

//   // Flatten the update payload into dot notation
//   const flattenedUpdates = buildUpdateQuery(updates);

//   // Separate scalar updates from array updates
//   const setUpdates: Record<string, any> = {};
//   const arrayUpdates: Record<string, any[]> = {};

//   Object.entries(flattenedUpdates).forEach(([key, value]) => {
//     if (Array.isArray(value)) {
//       arrayUpdates[key] = value;
//     } else {
//       setUpdates[key] = value;
//     }
//   });

//   // Build the final update query:
//   // - $set for scalar and nested field updates.
//   // - $addToSet with $each for arrays to merge new items.
//   const finalUpdateQuery: Record<string, any> = {};
//   if (Object.keys(setUpdates).length > 0) {
//     finalUpdateQuery.$set = setUpdates;
//   }
//   if (Object.keys(arrayUpdates).length > 0) {
//     const addToSet: Record<string, any> = {};
//     for (const [key, arr] of Object.entries(arrayUpdates)) {
//       addToSet[key] = { $each: arr };
//     }
//     finalUpdateQuery.$addToSet = addToSet;
//   }

//   // Perform the update using the combined query
//   const updatedProfile = await ProfileModel.findByIdAndUpdate(
//     id,
//     finalUpdateQuery,
//     { new: true, runValidators: true }
//   );
// console.log("updates made: ")
//   logger.info(`Profile updated: ${id} by user: ${user._id}`);
//   res.json(updatedProfile);
// });

// @desc    Delete a profile
// @route   DELETE /api/profiles/:id
// @access  Private
export const deleteProfile = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user as any;

    // Validate profile exists
    const profile = await ProfileModel.findById(id);
    if (!profile) {
      throw createHttpError(404, 'Profile not found');
    }

    // Check if user is owner or superadmin
    if (profile.owner.toString() !== user._id.toString() && user.role !== 'superadmin') {
      throw createHttpError(403, 'Not authorized to delete this profile');
    }

    // Remove profile from owner's profiles array
    await User.findByIdAndUpdate(profile.owner, {
      $pull: { profiles: profile._id }
    });

    // Delete the profile
    await ProfileModel.deleteOne({ _id: id });

    res.json({
      success: true,
      message: 'Profile deleted successfully'
    });
  } catch (error) {
    logger.error('Delete profile error:', error);
    res.status(error instanceof Error ? 400 : 500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to delete profile'
    });
  }
});

// @desc    Transfer profile ownership
// @route   POST /api/profiles/:id/transfer
// @access  Private
export const transferProfile = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { newOwnerId } = req.body;

  // Validate IDs
  if (!isValidObjectId(id) || !isValidObjectId(newOwnerId)) {
    throw createHttpError(400, 'Invalid profile or user ID');
  }

  // Find profile and check permissions
  const profile = await ProfileModel.findById(id);
  if (!profile) {
    throw createHttpError(404, 'Profile not found');
  }

  // Check if user has permission to transfer
  const user = req.user as RequestUser;
  if (!profile.owner.equals(user._id) && user.role !== 'superadmin') {
    throw createHttpError(403, 'You do not have permission to transfer this profile');
  }

  // Verify new owner exists and has sufficient MPTS
  const newOwner = await User.findById(newOwnerId);
  if (!newOwner) {
    throw createHttpError(404, 'New owner not found');
  }

  if (newOwner.mpts < 50) {
    throw createHttpError(400, 'New owner has insufficient trust score. Minimum required: 50 MPTS');
  }

  // Transfer ownership
  profile.owner = newOwner._id as mongoose.Types.ObjectId;
  if (!profile.managers.includes(newOwner._id as mongoose.Types.ObjectId)) {
    profile.managers.push(newOwner._id as mongoose.Types.ObjectId);
  }
  await profile.save();

  logger.info(`Profile ${id} transferred from ${user._id} to ${newOwnerId}`);
  res.json(profile);
});

// @desc    Add manager to profile
// @route   POST /api/profiles/:id/managers
// @access  Private
export const addProfileManager = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { managerId } = req.body;

  // Validate IDs
  if (!isValidObjectId(id) || !isValidObjectId(managerId)) {
    throw createHttpError(400, 'Invalid profile or user ID');
  }

  // Find profile and check permissions
  const profile = await ProfileModel.findById(id);
  if (!profile) {
    throw createHttpError(404, 'Profile not found');
  }

  // Check if user has permission to add managers
  const user = req.user as RequestUser;
  if (!profile.owner.equals(user._id) && user.role !== 'superadmin') {
    throw createHttpError(403, 'You do not have permission to add managers to this profile');
  }

  // Verify new manager exists and has sufficient MPTS
  const newManager = await User.findById(managerId);
  if (!newManager) {
    throw createHttpError(404, 'User not found');
  }

  if (newManager.mpts < 30) {
    throw createHttpError(400, 'User has insufficient trust score to be a manager. Minimum required: 30 MPTS');
  }

  // Add manager if not already in the list
  if (!profile.managers.includes(newManager._id as mongoose.Types.ObjectId)) {
    profile.managers.push(newManager._id as mongoose.Types.ObjectId);
    await profile.save();
  }

  logger.info(`Manager ${managerId} added to profile ${id} by user ${user._id}`);
  res.json(profile);
});

// @desc    Delete a user (superadmin only)
// @route   DELETE /api/users/:id
// @access  Private
export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    // Delete user and their profiles
    await ProfileModel.deleteMany({ owner: userId });
    await User.findByIdAndDelete(userId);

    res.status(200).json({
      success: true,
      message: 'User and associated profiles deleted successfully'
    });
  } catch (error) {
    logger.error('User deletion error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to delete user'
    });
  }
});

// @desc    Block a user (superadmin only)
// @route   POST /api/users/:id/block
// @access  Private
export const blockUser = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const user = await User.findByIdAndUpdate(userId,
      { isBlocked: true },
      { new: true }
    );

    if (!user) {
      throw createHttpError(404, 'User not found');
    }

    res.status(200).json({
      success: true,
      message: 'User blocked successfully'
    });
  } catch (error) {
    logger.error('User blocking error:', error);
    res.status(error instanceof Error ? 400 : 500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to block user'
    });
  }
});

// @desc    Unblock a user (superadmin only)
// @route   POST /api/users/:id/unblock
// @access  Private
export const unblockUser = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const user = await User.findByIdAndUpdate(userId,
      { isBlocked: false },
      { new: true }
    );

    if (!user) {
      throw createHttpError(404, 'User not found');
    }

    res.status(200).json({
      success: true,
      message: 'User unblocked successfully'
    });
  } catch (error) {
    logger.error('User unblocking error:', error);
    res.status(error instanceof Error ? 400 : 500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to unblock user'
    });
  }
});

// @desc    Add a manager to a profile
// @route   POST /api/profiles/:id/managers
// @access  Private
export const addManager = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { managerId } = req.body;
    const user = req.user as any;

    // Validate profile exists
    const profile = await ProfileModel.findById(id);
    if (!profile) {
      throw createHttpError(404, 'Profile not found');
    }

    // Check if user is owner or superadmin
    if (profile.owner.toString() !== user._id.toString() && user.role !== 'superadmin') {
      throw createHttpError(403, 'Not authorized to add managers to this profile');
    }

    // Validate manager exists
    const manager = await User.findById(managerId);
    if (!manager) {
      throw createHttpError(404, 'Manager user not found');
    }

    // Check if already a manager
    if (profile.managers.includes(managerId)) {
      throw createHttpError(400, 'User is already a manager of this profile');
    }

    // Add manager
    profile.managers.push(managerId);
    await profile.save();

    res.json({
      success: true,
      message: 'Manager added successfully',
      profile
    });
  } catch (error) {
    logger.error('Add manager error:', error);
    res.status(error instanceof Error ? 400 : 500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to add manager'
    });
  }
});

// @desc    Remove a manager from a profile
// @route   DELETE /api/profiles/:id/managers/:managerId
// @access  Private
export const removeManager = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id, managerId } = req.params;
    const user = req.user as any;

    // Validate profile exists
    const profile = await ProfileModel.findById(id);
    if (!profile) {
      throw createHttpError(404, 'Profile not found');
    }

    // Check if user is owner or superadmin
    if (profile.owner.toString() !== user._id.toString() && user.role !== 'superadmin') {
      throw createHttpError(403, 'Not authorized to remove managers from this profile');
    }

    // Cannot remove the owner from managers
    if (profile.owner.toString() === managerId) {
      throw createHttpError(400, 'Cannot remove profile owner from managers');
    }

    // Remove manager
    profile.managers = profile.managers.filter(m => m.toString() !== managerId);
    await profile.save();

    res.json({
      success: true,
      message: 'Manager removed successfully',
      profile
    });
  } catch (error) {
    logger.error('Remove manager error:', error);
    res.status(error instanceof Error ? 400 : 500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to remove manager'
    });
  }
});

// @desc    Update profile visibility
// @route   PUT /api/profiles/:id/visibility
// @access  Private
export const updateProfileVisibility = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { visibility } = req.body;
  const user = req.user as RequestUser;

  if (!isValidObjectId(id)) {
    throw createHttpError(400, 'Invalid profile ID');
  }

  if (!['public', 'private'].includes(visibility)) {
    throw createHttpError(400, 'Visibility must be either "public" or "private"');
  }

  const profile: any = await ProfileModel.findById(id);
  if (!profile) {
    throw createHttpError(404, 'Profile not found');
  }

  // Only owner and superadmin can change visibility
  if (profile.owner.toString() !== user._id.toString() && user.role !== 'superadmin') {
    throw createHttpError(403, 'Only the profile owner or superadmin can change visibility settings');
  }

  // Update visibility in settings
  profile.settings.visibility = visibility;
  await profile.save();

  res.json({
    success: true,
    message: `Profile visibility updated to ${visibility}`,
    profile
  });
});

// @desc    Update profile settings
// @route   PUT /api/profiles/:id/settings
// @access  Private
export const updateProfileSettings = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const settings = req.body;
  const user = req.user as RequestUser;

  if (!isValidObjectId(id)) {
    throw createHttpError(400, 'Invalid profile ID');
  }

  const profile = await ProfileModel.findById(id);
  if (!profile) {
    throw createHttpError(404, 'Profile not found');
  }

  // Only owner and superadmin can change settings
  if (profile.owner.toString() !== user._id.toString() && user.role !== 'superadmin') {
    throw createHttpError(403, 'Only the profile owner or superadmin can change profile settings');
  }

  // Validate visibility if it's being updated
  if (settings.visibility && !['public', 'private'].includes(settings.visibility)) {
    throw createHttpError(400, 'Visibility must be either "public" or "private"');
  }

  // Update settings
  profile.settings = {
    ...profile.settings,
    ...settings
  };

  await profile.save();

  res.json({
    success: true,
    message: 'Profile settings updated successfully',
    profile
  });
});



// @desc    Get all user profiles grouped by category
// @route   GET /api/profiles/user-profiles?category= individual | functional | group
// @access  Private
export const getUserProfilesGrouped = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = {
    _id: "67e41de4bc8ce32407f11e1c",
    role: "user",
    token: "dfudiufhdifuhdiu.ggndiufdhiufhidf.dffdjhbdjhbj"
  };
  // const user = req.user as RequestUser;

  if (!user) {
    throw createHttpError(401, 'Unauthorized');
  }

 
  const filter = req.query.category as string | undefined;
  const matchQuery: any = { owner: new Types.ObjectId(user._id) };

  if (filter) {
    
    matchQuery.profileCategory = { $regex: `^${filter}$`, $options: "i" };
  }

  //Aggregation pipeline
  const pipeline = [
    { $match: matchQuery },
    {
      $project: {
        _id: 1,
        name: 1,
        owner:1,
        details: 1,
        type: 1,
        createdAt: 1,
        profileCategory: 1
      }
    },
    {
      $group: {
        _id: "$type.category",
        profiles: { $push: { _id:"$_id", name: "$name", details:"$details",type: "$type", owner:"$owner" ,createdAt: "$createdAt" } }
      }
    }
  ];

  const groupedProfiles = await ProfileModel.aggregate(pipeline);


  const result: Record<string, any> = {};
  groupedProfiles.forEach((group) => {
    const key = group._id ? group._id.toString().toLowerCase() : 'unknown';
    result[key] = group.profiles;
  });

  if (filter) {
    const normalizedFilter = filter.toLowerCase();
    res.status(200).json({ success: true, profiles: result[normalizedFilter] || [] });
    return;
  }

  res.status(200).json({ success: true, profiles: result });
});


/**
 * Recursively flattens an object into dot notation key/value pairs.
 * It leaves arrays and Date objects unchanged.
 * @param obj - The object to flatten.
 * @param prefix - The prefix for nested keys.
 * @returns A flattened object using dot notation.
 */
function buildUpdateQuery(obj: Record<string, any>, prefix = ''): Record<string, any> {
  let result: Record<string, any> = {};
  for (const key in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
    const value = obj[key];
    const newKey = prefix ? `${prefix}.${key}` : key;
    // Flatten plain objects only; arrays and Date instances are left as-is.
    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      Object.assign(result, buildUpdateQuery(value, newKey));
    } else {
      result[newKey] = value;
    }
  }
  return result;
}

/**
 * Updates a profile document.
 *
 * This endpoint accepts nested updates (only the fields that need to change) and:
 *  - Flattens the update payload into dot notation.
 *  - Separates scalar updates and array updates.
 *  - Uses $set for scalar updates and $addToSet with $each for array updates.
 *
 * Protected fields (owner, managers, claimed, claimedBy, qrCode) are removed.
 *
 * Example request body to update a nested field:
 * {
 *   "categories": {
 *     "about": {
 *       "interestAndGoals": {
 *         "content": "my first profile created"
 *       }
 *     }
 *   }
 * }
 *
 * The above will be flattened to update the field 'categories.about.interestAndGoals.content'.
 */
export const updateProfileNew = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  // const updates = {
  //   "categories": {
  //     "about": {
  //       "interestAndGoals": {
  //         "enabled":false,
  //         "content": "my first profile created"
  //       }
  //     }
  //   }
  // }
  const updates = req.body;
  const user = req.user as RequestUser;
  

  // Validate profile ID
  if(!isValidObjectId(id)) {
    throw createHttpError(400, 'Invalid profile ID');
  }

  // Find profile
  const profile = await ProfileModel.findById(id);
  if (!profile) {
    throw createHttpError(404, 'Profile not found');
  }

  // const user = {
  //   _id: "67e41de4bc8ce32407f11e1c",
  //   role: "user",
  //   token: "dfudiufhdifuhdiu.ggndiufdhiufhidf.dffdjhbdjhbj"
  // };

  // Uncomment and adjust permission check in production:
  // if (!profile.managers.includes(user._id) && !profile.owner.equals(user._id) && user.role !== 'superadmin') {
  //   throw createHttpError(403, 'You do not have permission to update this profile');
  // }

  // Remove protected fields from updates
  // delete updates.owner;
  // delete updates.managers;
  // delete updates.claimed;
  // delete updates.claimedBy;
  // delete updates.qrCode;

  // Flatten the update payload into dot notation
  const flattenedUpdates = buildUpdateQuery(updates);

  // Separate scalar updates from array updates
  const setUpdates: Record<string, any> = {};
  const arrayUpdates: Record<string, any[]> = {};

  Object.entries(flattenedUpdates).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      arrayUpdates[key] = value;
    } else {
      setUpdates[key] = value;
    }
  });


  const finalUpdateQuery: Record<string, any> = {};
  if (Object.keys(setUpdates).length > 0) {
    finalUpdateQuery.$set = setUpdates;
  }
  if (Object.keys(arrayUpdates).length > 0) {
    const addToSet: Record<string, any> = {};
    for (const [key, arr] of Object.entries(arrayUpdates)) {
      addToSet[key] = { $each: arr };
    }
    finalUpdateQuery.$addToSet = addToSet;
  }

  // Debug log the final update query
  logger.debug(`Final update query: ${JSON.stringify(finalUpdateQuery, null, 2)}`);

  // Perform the update
  const updatedProfile = await ProfileModel.findByIdAndUpdate(
    id,
    finalUpdateQuery,
    { new: true, runValidators: true }
  );

  logger.info(`Profile updated: ${id} by user: ${user._id}`);
  res.status(200).json(updatedProfile);
});
