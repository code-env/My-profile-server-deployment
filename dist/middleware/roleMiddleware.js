"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUserToAdmin = exports.checkProfileOwnership = exports.requireRole = void 0;
const errors_1 = require("../utils/errors");
const User_1 = require("../models/User");
const profile_model_1 = require("../models/profile.model");
const logger_1 = require("../utils/logger");
const requireRole = (roles) => {
    return async (req, res, next) => {
        try {
            const user = req.user;
            // const user = {
            //     "_id":"67deb94fd0eac9122a27148b",
            //     "role":"user",
            //     "token":"dfudiufhdifuhdiu.ggndiufdhiufhidf.dffdjhbdjhbj"
            //   }
            if (!user) {
                throw new errors_1.CustomError('UNAUTHORIZED', 'Authentication required');
            }
            // Default to 'user' role if none is specified
            const userRole = user.role || 'user';
            if (!roles.includes(userRole)) {
                logger_1.logger.error(`Role verification failed: User role '${userRole}' not in allowed roles [${roles.join(', ')}]`);
                throw new errors_1.CustomError('FORBIDDEN', 'Insufficient permissions');
            }
            next();
        }
        catch (error) {
            logger_1.logger.error('Role verification error:', error);
            res.status(error instanceof errors_1.CustomError ? 403 : 500).json({
                success: false,
                message: error instanceof Error ? error.message : 'Permission denied'
            });
        }
    };
};
exports.requireRole = requireRole;
const checkProfileOwnership = async (req, res, next) => {
    try {
        const user = req.user;
        const profileId = req.params.id;
        if (!profileId) {
            throw new errors_1.CustomError('BAD_REQUEST', 'Profile ID is required');
        }
        // Superadmin can access all profiles
        if (user.role === 'superadmin') {
            return next();
        }
        // For other users, check if they own or manage the profile
        const profile = await profile_model_1.ProfileModel.findById(profileId);
        if (!profile) {
            throw new errors_1.CustomError('NOT_FOUND', 'Profile not found');
        }
        const isOwner = profile.owner.equals(user._id);
        const isManager = profile.managers.some(managerId => managerId.equals(user._id));
        const isAdmin = user.role === 'admin';
        if (!isOwner && !isManager && !isAdmin) {
            logger_1.logger.error(`Profile access denied: User ${user._id} attempted to access profile ${profileId}`);
            throw new errors_1.CustomError('FORBIDDEN', 'You do not have permission to access this profile');
        }
        // Attach profile to request for later use
        req.profile = profile;
        next();
    }
    catch (error) {
        logger_1.logger.error('Profile ownership verification error:', error);
        res.status(error instanceof errors_1.CustomError ? 403 : 500).json({
            success: false,
            message: error instanceof Error ? error.message : 'Permission denied'
        });
    }
};
exports.checkProfileOwnership = checkProfileOwnership;
const updateUserToAdmin = async (userId) => {
    try {
        const user = await User_1.User.findById(userId);
        if (user && user.profiles.length > 1 && user.role === 'user') {
            user.role = 'admin';
            await user.save();
            logger_1.logger.info(`User ${user.email} promoted to admin due to multiple profiles`);
        }
    }
    catch (error) {
        logger_1.logger.error('Error updating user role:', error);
    }
};
exports.updateUserToAdmin = updateUserToAdmin;
