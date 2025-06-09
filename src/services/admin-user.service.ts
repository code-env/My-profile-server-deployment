import { User, IUser } from '../models/User';
import mongoose from 'mongoose';
import { ProfileModel } from '../models/profile.model';
import { logger } from '../utils/logger';

export interface UserFilters {
  search?: string;
  role?: string;
  accountType?: string;
  isEmailVerified?: boolean;
  isPhoneVerified?: boolean;
  status?: 'active' | 'inactive' | 'banned';
  dateJoinedFrom?: Date;
  dateJoinedTo?: Date;
  lastLoginFrom?: Date;
  lastLoginTo?: Date;
  countryOfResidence?: string;
}

export interface UserListResponse {
  users: IUser[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface UserStats {
  totalUsers: number;
  activeUsers: number;
  verifiedUsers: number;
  usersByRole: Record<string, number>;
  usersByAccountType: Record<string, number>;
  newUsersThisWeek: number;
  newUsersThisMonth: number;
  recentLoginCount: number;
}

class AdminUserService {
  /**
   * Create a new user (admin only)
   */
  async createUser(userData: {
    email: string;
    password: string;
    fullName: string;
    username: string;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: Date;
    countryOfResidence?: string;
    phoneNumber?: string;
    accountType: 'MYSELF' | 'SOMEONE_ELSE';
    accountCategory: 'PRIMARY_ACCOUNT' | 'SECONDARY_ACCOUNT';
    verificationMethod: 'PHONE' | 'EMAIL';
    role?: 'user' | 'admin' | 'superadmin';
    isEmailVerified?: boolean;
    isPhoneVerified?: boolean;
  }): Promise<IUser> {
    // Check if user with email or username already exists
    const existingUser = await User.findOne({
      $or: [
        { email: userData.email.toLowerCase() },
        { username: userData.username }
      ]
    });

    if (existingUser) {
      throw new Error('User with this email or username already exists');
    }

    // If phone number is provided, check for duplicates
    if (userData.phoneNumber) {
      const existingPhoneUser = await User.findOne({ phoneNumber: userData.phoneNumber });
      if (existingPhoneUser) {
        throw new Error('User with this phone number already exists');
      }
    }

    // Set default role if not provided
    const role = userData.role || 'user';

    // Validate role
    const validRoles = ['user', 'admin', 'superadmin'];
    if (!validRoles.includes(role)) {
      throw new Error(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
    }

    // Create new user
    const newUser = new User({
      email: userData.email.toLowerCase(),
      password: userData.password,
      fullName: userData.fullName,
      username: userData.username,
      firstName: userData.firstName,
      lastName: userData.lastName,
      dateOfBirth: userData.dateOfBirth,
      countryOfResidence: userData.countryOfResidence,
      phoneNumber: userData.phoneNumber,
      accountType: userData.accountType,
      accountCategory: userData.accountCategory,
      verificationMethod: userData.verificationMethod,
      role: role,
      signupType: 'email',
      isEmailVerified: userData.isEmailVerified || false,
      isPhoneVerified: userData.isPhoneVerified || false,
      registrationStep: 'VERIFICATION'
    });

    await newUser.save();

    // Remove sensitive fields from response
    const userResponse = await User.findById(newUser._id)
      .select('-password -twoFactorSecret -refreshTokens')
      .lean();

    return userResponse as IUser;
  }

  /**
   * Get all users with pagination and filtering
   */
  async getAllUsers(
    page: number = 1,
    limit: number = 20,
    filters: UserFilters = {}
  ): Promise<UserListResponse> {
    const query: any = {};
    
    // Apply search filter
    if (filters.search) {
      const searchRegex = new RegExp(filters.search, 'i');
      query.$or = [
        { fullName: searchRegex },
        { email: searchRegex },
        { username: searchRegex },
        { phoneNumber: searchRegex }
      ];
    }

    // Apply role filter
    if (filters.role) {
      query.role = filters.role;
    }

    // Apply account type filter
    if (filters.accountType) {
      query.accountType = filters.accountType;
    }

    // Apply verification filters
    if (filters.isEmailVerified !== undefined) {
      query.isEmailVerified = filters.isEmailVerified;
    }

    if (filters.isPhoneVerified !== undefined) {
      query.isPhoneVerified = filters.isPhoneVerified;
    }

    // Apply status filter
    if (filters.status) {
      switch (filters.status) {
        case 'active':
          query.isAccountLocked = { $ne: true };
          query.isBanned = { $ne: true };
          break;
        case 'inactive':
          query.isAccountLocked = true;
          break;
        case 'banned':
          query.isBanned = true;
          break;
      }
    }

    // Apply date filters
    if (filters.dateJoinedFrom || filters.dateJoinedTo) {
      query.createdAt = {};
      if (filters.dateJoinedFrom) {
        query.createdAt.$gte = filters.dateJoinedFrom;
      }
      if (filters.dateJoinedTo) {
        query.createdAt.$lte = filters.dateJoinedTo;
      }
    }

    if (filters.lastLoginFrom || filters.lastLoginTo) {
      query.lastLogin = {};
      if (filters.lastLoginFrom) {
        query.lastLogin.$gte = filters.lastLoginFrom;
      }
      if (filters.lastLoginTo) {
        query.lastLogin.$lte = filters.lastLoginTo;
      }
    }

    // Apply country filter
    if (filters.countryOfResidence) {
      query.countryOfResidence = filters.countryOfResidence;
    }

    const skip = (page - 1) * limit;

    const [users, totalCount] = await Promise.all([
      User.find(query)
        .select('-password -twoFactorSecret -refreshTokens')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(query)
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return {
      users: users as IUser[],
      totalCount,
      totalPages,
      currentPage: page,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    };
  }

  /**
   * Get user by ID with detailed information
   */
  async getUserById(userId: string): Promise<IUser | null> {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID');
    }

    const user = await User.findById(userId)
      .select('-password -twoFactorSecret -refreshTokens')
      .lean();

    return user as IUser | null;
  }

  /**
   * Update user by admin
   */
  async updateUser(userId: string, updateData: Partial<IUser>): Promise<IUser> {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID');
    }

    // Prevent updating sensitive fields directly
    const { password, twoFactorSecret, refreshTokens, ...safeUpdateData } = updateData as any;

    const user = await User.findByIdAndUpdate(
      userId,
      safeUpdateData,
      { new: true, runValidators: true }
    ).select('-password -twoFactorSecret -refreshTokens');

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  /**
   * Delete user and all associated data
   */
  async deleteUser(userId: string): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Delete all user profiles
      await ProfileModel.deleteMany({ 'profileInformation.creator': userId }).session(session);

      // Delete the user
      const deleteResult = await User.findByIdAndDelete(userId).session(session);

      if (!deleteResult) {
        throw new Error('User not found');
      }

      await session.commitTransaction();
      return true;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Ban/unban user
   */
  async toggleUserBan(userId: string, banned: boolean, reason?: string): Promise<IUser> {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID');
    }

    const updateData: any = {
      isBanned: banned,
      bannedAt: banned ? new Date() : undefined,
      banReason: banned ? reason : undefined
    };

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password -twoFactorSecret -refreshTokens');

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  /**
   * Lock/unlock user account
   */
  async toggleUserLock(userId: string, locked: boolean, reason?: string): Promise<IUser> {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID');
    }

    const updateData: any = {
      isAccountLocked: locked,
      lockedAt: locked ? new Date() : undefined,
      lockReason: locked ? reason : undefined
    };

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password -twoFactorSecret -refreshTokens');

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  /**
   * Change user role
   */
  async changeUserRole(userId: string, newRole: string): Promise<IUser> {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID');
    }

    const validRoles = ['user', 'admin', 'superadmin'];
    if (!validRoles.includes(newRole)) {
      throw new Error(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { role: newRole },
      { new: true, runValidators: true }
    ).select('-password -twoFactorSecret -refreshTokens');

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  /**
   * Force verify user email/phone
   */
  async forceVerifyUser(userId: string, type: 'email' | 'phone'): Promise<IUser> {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID');
    }

    const updateData = type === 'email' 
      ? { isEmailVerified: true, emailVerifiedAt: new Date() }
      : { isPhoneVerified: true, phoneVerifiedAt: new Date() };

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password -twoFactorSecret -refreshTokens');

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  /**
   * Get user statistics
   */
  async getUserStats(): Promise<UserStats> {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentLoginThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      activeUsers,
      verifiedUsers,
      roleStats,
      accountTypeStats,
      newUsersThisWeek,
      newUsersThisMonth,
      recentLoginCount
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ 
        isAccountLocked: { $ne: true }, 
        isBanned: { $ne: true } 
      }),
      User.countDocuments({ 
        isEmailVerified: true 
      }),
      User.aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } }
      ]),
      User.aggregate([
        { $group: { _id: '$accountType', count: { $sum: 1 } } }
      ]),
      User.countDocuments({ 
        createdAt: { $gte: weekAgo } 
      }),
      User.countDocuments({ 
        createdAt: { $gte: monthAgo } 
      }),
      User.countDocuments({ 
        lastLogin: { $gte: recentLoginThreshold } 
      })
    ]);

    const usersByRole: Record<string, number> = {};
    roleStats.forEach((stat: any) => {
      usersByRole[stat._id || 'unknown'] = stat.count;
    });

    const usersByAccountType: Record<string, number> = {};
    accountTypeStats.forEach((stat: any) => {
      usersByAccountType[stat._id || 'unknown'] = stat.count;
    });

    return {
      totalUsers,
      activeUsers,
      verifiedUsers,
      usersByRole,
      usersByAccountType,
      newUsersThisWeek,
      newUsersThisMonth,
      recentLoginCount
    };
  }

  /**
   * Bulk operations
   */
  async bulkUpdateUsers(userIds: string[], updateData: Partial<IUser>): Promise<{
    updated: number;
    failed: string[];
  }> {
    const validIds = userIds.filter(id => mongoose.Types.ObjectId.isValid(id));
    const invalidIds = userIds.filter(id => !mongoose.Types.ObjectId.isValid(id));

    if (validIds.length === 0) {
      return { updated: 0, failed: invalidIds };
    }

    // Prevent updating sensitive fields
    const { password, twoFactorSecret, refreshTokens, ...safeUpdateData } = updateData as any;

    const result = await User.updateMany(
      { _id: { $in: validIds } },
      safeUpdateData
    );

    return {
      updated: result.modifiedCount,
      failed: invalidIds
    };
  }

  /**
   * Search users by various criteria
   */
  async searchUsers(
    searchTerm: string,
    limit: number = 10
  ): Promise<IUser[]> {
    const searchRegex = new RegExp(searchTerm, 'i');
    
    const users = await User.find({
      $or: [
        { fullName: searchRegex },
        { email: searchRegex },
        { username: searchRegex },
        { phoneNumber: searchRegex }
      ]
    })
    .select('-password -twoFactorSecret -refreshTokens')
    .limit(limit)
    .lean();

    return users as IUser[];
  }
}

export default new AdminUserService(); 