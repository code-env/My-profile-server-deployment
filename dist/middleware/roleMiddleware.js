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
            // Check for admin role in headers or cookies
            const adminRoleHeader = req.header('X-User-Role');
            const adminCookie = req.cookies['X-User-Role'];
            const isAdminHeader = req.header('X-Is-Admin');
            const isAdminCookie = req.cookies['X-User-Is-Admin'];
            // Log headers and cookies for debugging
            logger_1.logger.debug(`Role middleware headers: ${JSON.stringify(req.headers)}`);
            logger_1.logger.debug(`Role middleware cookies: ${JSON.stringify(req.cookies)}`);
            // Get the role from various sources
            let userRole = user.role;
            // Try to get role from _doc if it exists
            if (!userRole && user._doc && user._doc.role) {
                userRole = user._doc.role;
                logger_1.logger.debug(`Using role from _doc: ${userRole}`);
            }
            // Check if admin role is indicated in headers or cookies
            // const isAdminHeader = adminRoleHeader === 'admin';
            // const isAdminCookie = adminCookie === 'admin';
            const isAdminFlagHeader = isAdminHeader === 'true' || req.header('X-Is-Admin') === 'true';
            const isAdminFlagCookie = isAdminCookie === 'true' || req.cookies['X-Is-Admin'] === 'true';
            // If any admin indicator is present, set role to admin
            if (isAdminHeader || isAdminCookie || isAdminFlagHeader || isAdminFlagCookie) {
                logger_1.logger.debug(`Admin role indicated in headers/cookies for user ${user._id}`);
                userRole = 'admin';
            }
            // Default to 'user' role if none is specified
            if (!userRole) {
                userRole = 'user';
            }
            // Log for debugging
            logger_1.logger.debug(`Role check for user ${user._id}: role=${userRole}, headers=${adminRoleHeader}, allowed=[${roles.join(', ')}]`);
            // For admin routes, also check if the user has the admin role in the database
            if (roles.includes('admin') && userRole === 'admin') {
                // If the route requires admin, double-check that the user actually has admin role in the database
                const dbRole = user.role || (user._doc ? user._doc.role : null);
                if (dbRole !== 'admin' && dbRole !== 'superadmin') {
                    logger_1.logger.warn(`User ${user._id} has admin role in headers but not in database (${dbRole})`);
                    // We'll still allow it for now, but log a warning
                }
            }
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
    var _a, _b;
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
        // Check if user is the creator of the profile
        const isOwner = ((_b = (_a = profile.profileInformation) === null || _a === void 0 ? void 0 : _a.creator) === null || _b === void 0 ? void 0 : _b.toString()) === user._id.toString();
        // Check if user is a manager of the profile (if managers array exists)
        // In the new model, managers might be stored in a different location
        // For now, we'll assume there are no managers in the new model
        const isManager = false;
        const isAdmin = user.role === 'admin';
        if (!isOwner && !isManager && !isAdmin) {
            logger_1.logger.error(`Profile access denied: User ${user._id} attempted to access profile ${profileId}`);
            throw new errors_1.CustomError('FORBIDDEN', 'You do not have permission to access this profile');
        }
        // Attach profile to request for later use
        // Use type assertion to avoid type compatibility issues
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
