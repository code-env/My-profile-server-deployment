"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfileController = void 0;
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const http_errors_1 = __importDefault(require("http-errors"));
const mongoose_1 = require("mongoose");
const profile_service_1 = require("../services/profile.service");
const logger_1 = require("../utils/logger");
class ProfileController {
    constructor() {
        this.service = new profile_service_1.ProfileService();
        /** POST /p */
        this.createProfile = (0, express_async_handler_1.default)(async (req, res) => {
            var _a;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
            if (!userId)
                throw (0, http_errors_1.default)(401, 'Unauthorized');
            const { templateId, profileInformation, sections } = req.body;
            if (!templateId)
                throw (0, http_errors_1.default)(400, 'templateId is required');
            if (!(profileInformation === null || profileInformation === void 0 ? void 0 : profileInformation.username))
                throw (0, http_errors_1.default)(400, 'username is required');
            const profile = await this.service.createProfileWithContent(userId, templateId, profileInformation, sections);
            // Format the profile data for frontend consumption
            const formattedProfile = this.formatProfileData(profile);
            res.status(201).json({ success: true, profile: formattedProfile });
        });
        /** POST /p/:profileId/fields */
        this.setEnabledFields = (0, express_async_handler_1.default)(async (req, res) => {
            var _a;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
            if (!userId)
                throw (0, http_errors_1.default)(401, 'Unauthorized');
            const { profileId } = req.params;
            if (!(0, mongoose_1.isValidObjectId)(profileId))
                throw (0, http_errors_1.default)(400, 'Invalid profileId');
            const toggles = req.body;
            if (!Array.isArray(toggles))
                throw (0, http_errors_1.default)(400, 'Expected array of field toggles');
            const updated = await this.service.setEnabledFields(profileId, userId, toggles);
            // Format the profile data for frontend consumption
            const formattedProfile = this.formatProfileData(updated);
            res.json({ success: true, profile: formattedProfile });
        });
        /** PUT /p/:profileId/content */
        this.updateProfileContent = (0, express_async_handler_1.default)(async (req, res) => {
            var _a;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
            if (!userId)
                throw (0, http_errors_1.default)(401, 'Unauthorized');
            const { profileId } = req.params;
            if (!(0, mongoose_1.isValidObjectId)(profileId))
                throw (0, http_errors_1.default)(400, 'Invalid profileId');
            const updates = req.body;
            if (!Array.isArray(updates))
                throw (0, http_errors_1.default)(400, 'Expected array of field updates');
            const updated = await this.service.updateProfileContent(profileId, userId, updates);
            // Format the profile data for frontend consumption
            const formattedProfile = this.formatProfileData(updated);
            res.json({ success: true, profile: formattedProfile });
        });
        /** GET /p/:profileId */
        this.getProfile = (0, express_async_handler_1.default)(async (req, res) => {
            const { profileId } = req.params;
            if (!(0, mongoose_1.isValidObjectId)(profileId))
                throw (0, http_errors_1.default)(400, 'Invalid profileId');
            const profile = await this.service.getProfile(profileId);
            // Format the profile data for frontend consumption
            const formattedProfile = this.formatProfileData(profile);
            res.json({ success: true, profile: formattedProfile });
        });
        /** GET /p */
        this.getUserProfiles = (0, express_async_handler_1.default)(async (req, res) => {
            var _a;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
            if (!userId)
                throw (0, http_errors_1.default)(401, 'Unauthorized');
            const profiles = await this.service.getUserProfiles(userId);
            // Format each profile for frontend consumption
            const formattedProfiles = profiles.map(profile => this.formatProfileData(profile));
            res.json({ success: true, profiles: formattedProfiles });
        });
        /** DELETE /p/:profileId */
        this.deleteProfile = (0, express_async_handler_1.default)(async (req, res) => {
            var _a;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
            if (!userId)
                throw (0, http_errors_1.default)(401, 'Unauthorized');
            const { profileId } = req.params;
            if (!(0, mongoose_1.isValidObjectId)(profileId))
                throw (0, http_errors_1.default)(400, 'Invalid profileId');
            const deleted = await this.service.deleteProfile(profileId, userId);
            res.json({ success: deleted });
        });
        /** PUT /p/:profileId/basic-info */
        this.updateProfileBasicInfo = (0, express_async_handler_1.default)(async (req, res) => {
            var _a;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
            if (!userId)
                throw (0, http_errors_1.default)(401, 'Unauthorized');
            const { profileId } = req.params;
            if (!(0, mongoose_1.isValidObjectId)(profileId))
                throw (0, http_errors_1.default)(400, 'Invalid profileId');
            const { username, description } = req.body;
            if (!username)
                throw (0, http_errors_1.default)(400, 'Username is required');
            const updated = await this.service.updateProfileBasicInfo(profileId, userId, username, description);
            // Format the profile data for frontend consumption
            const formattedProfile = this.formatProfileData(updated);
            res.json({ success: true, profile: formattedProfile });
        });
        /** POST /default */
        this.createDefaultProfile = (0, express_async_handler_1.default)(async (req, res) => {
            var _a;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
            if (!userId)
                throw (0, http_errors_1.default)(401, 'Unauthorized');
            const profile = await this.service.createDefaultProfile(userId);
            // Format the profile data for frontend consumption
            const formattedProfile = this.formatProfileData(profile);
            res.status(201).json({ success: true, profile: formattedProfile });
        });
        /** GET /all - Get all profiles (admin only) */
        this.getAllProfiles = (0, express_async_handler_1.default)(async (req, res) => {
            const user = req.user;
            // Check if user is authenticated and has admin role
            if (!(user === null || user === void 0 ? void 0 : user._id))
                throw (0, http_errors_1.default)(401, 'Unauthorized');
            if (!user.role || !['admin', 'superadmin'].includes(user.role)) {
                throw (0, http_errors_1.default)(403, 'Admin access required');
            }
            logger_1.logger.info(`Admin user ${user._id} (${user.email}) requesting all profiles`);
            // Parse query parameters for pagination and filtering
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const skip = (page - 1) * limit;
            // Get filter parameters
            const nameFilter = req.query.name;
            const categoryFilter = req.query.category;
            const typeFilter = req.query.type;
            // Build filter object
            const filter = {};
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
        this.getAvailableSlots = (0, express_async_handler_1.default)(async (req, res, next) => {
            const { profileId } = req.params;
            const { date } = req.query;
            if (!date) {
                throw (0, http_errors_1.default)(400, 'Date is required');
            }
            const slots = await this.service.getAvailableSlots(profileId, new Date(date));
            res.status(200).json({
                success: true,
                data: slots,
                message: 'Available slots retrieved successfully'
            });
        });
        /**
         * Set profile availability
         */
        this.setAvailability = (0, express_async_handler_1.default)(async (req, res, next) => {
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
        this.updateAvailability = (0, express_async_handler_1.default)(async (req, res, next) => {
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
        this.getAvailability = (0, express_async_handler_1.default)(async (req, res, next) => {
            const { profileId } = req.params;
            const availability = await this.service.getAvailability(profileId);
            res.status(200).json({
                success: true,
                data: availability,
                message: 'Profile availability retrieved successfully'
            });
        });
    }
    /**
     * Helper function to format profile data for frontend consumption
     * @param profile The profile document to format
     * @returns Formatted profile data
     */
    formatProfileData(profile) {
        var _a, _b, _c, _d, _e;
        try {
            logger_1.logger.info(`Formatting profile data for profile ID: ${profile._id}`);
            // Extract profile information
            const profileInfo = profile.profileInformation || {};
            const profileMyPts = profile.ProfileMypts || { currentBalance: 0, lifetimeMypts: 0 };
            // Find fullName in sections if available
            let fullName = null;
            const basicSection = (_a = profile.sections) === null || _a === void 0 ? void 0 : _a.find(s => s.key === 'basic');
            if (basicSection) {
                const fullNameField = (_b = basicSection.fields) === null || _b === void 0 ? void 0 : _b.find(f => f.key === 'fullName');
                if (fullNameField) {
                    // Use type assertion to safely access the value property
                    const fieldValue = fullNameField.value;
                    if (fieldValue) {
                        fullName = fieldValue;
                        logger_1.logger.debug(`Found fullName in sections: ${fullName}`);
                    }
                }
            }
            // IMPORTANT: Always use username as the name to avoid "Untitled Profile" issue
            // This is the most reliable way to ensure we have a consistent name
            let name = profileInfo.username || 'Profile';
            // Log what we're using as the name
            logger_1.logger.info(`Using username "${profileInfo.username}" as profile name`);
            // Final check to ensure we never return "Untitled Profile"
            if (name === 'Untitled Profile') {
                name = profileInfo.username || 'Profile';
                logger_1.logger.debug(`Replaced "Untitled Profile" with: ${name}`);
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
            logger_1.logger.info(`Formatted profile name: "${name}", balance: ${balance}`);
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
                // Include the raw profile data for debugging
                _rawProfile: process.env.NODE_ENV === 'development' ? profile : undefined
            };
            // Final check to ensure name is never "Untitled Profile"
            if (formattedData.name === 'Untitled Profile') {
                formattedData.name = profileInfo.username || 'Profile';
                logger_1.logger.warn(`Fixed "Untitled Profile" in final output to: ${formattedData.name}`);
            }
            logger_1.logger.info(`Final formatted profile name: "${formattedData.name}"`);
            return formattedData;
        }
        catch (error) {
            logger_1.logger.error('Error formatting profile data:', error);
            // Log the profile data that caused the error
            try {
                logger_1.logger.error(`Profile data that caused error: ${JSON.stringify({
                    id: profile._id,
                    profileInfo: profile.profileInformation,
                    sections: (_c = profile.sections) === null || _c === void 0 ? void 0 : _c.map(s => { var _a; return ({ key: s.key, fields: (_a = s.fields) === null || _a === void 0 ? void 0 : _a.map(f => ({ key: f.key })) }); })
                })}`);
            }
            catch (logError) {
                logger_1.logger.error('Error logging profile data:', logError);
            }
            // Try to get username from profile information
            let fallbackName = 'Profile';
            try {
                if ((_d = profile.profileInformation) === null || _d === void 0 ? void 0 : _d.username) {
                    fallbackName = profile.profileInformation.username;
                    logger_1.logger.info(`Using username "${fallbackName}" for fallback profile name`);
                }
            }
            catch (nameError) {
                logger_1.logger.error('Error getting username for fallback:', nameError);
            }
            // Return basic profile data if formatting fails
            const fallbackData = {
                _id: profile._id,
                id: profile._id,
                secondaryId: profile.secondaryId || null, // Include the secondary ID
                name: fallbackName, // Use username or 'Profile' instead of 'Untitled Profile'
                username: ((_e = profile.profileInformation) === null || _e === void 0 ? void 0 : _e.username) || '',
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
            logger_1.logger.info('Returning fallback profile data');
            return fallbackData;
        }
    }
}
exports.ProfileController = ProfileController;
