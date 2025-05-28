"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfileService = void 0;
const profile_model_1 = require("../models/profile.model");
const mongoose_1 = require("mongoose");
const http_errors_1 = __importDefault(require("http-errors"));
const logger_1 = require("../utils/logger");
const User_1 = require("../models/User");
const profile_template_1 = require("../models/profiles/profile-template");
const crypto_1 = require("../utils/crypto");
const gradient_generator_1 = require("../utils/gradient-generator");
const mongoose_2 = __importDefault(require("mongoose"));
// No custom interfaces needed - we'll use type assertions with 'any' where necessary
class ProfileService {
    /**
     * Creates a profile with content in one step
     * @param userId The user ID creating the profile
     * @param templateId The template ID to base the profile on
     * @param profileInformation Basic profile information
     * @param sections Optional sections with field values and enabled status
     * @returns The created profile document
     */
    async createProfileWithContent(userId, templateId, profileInformation, sections) {
        logger_1.logger.info(`Creating profile with content for user ${userId} using template ${templateId}`);
        // Create the base profile
        const profile = await this.createProfile(userId, templateId);
        // Update profile information
        if (profileInformation) {
            profile.profileInformation.username = profileInformation.username;
            if (profileInformation.title)
                profile.profileInformation.title = profileInformation.title;
            if (profileInformation.accountHolder)
                profile.profileInformation.accountHolder = profileInformation.accountHolder;
            if (profileInformation.pid)
                profile.profileInformation.pid = profileInformation.pid;
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
                            profileField.value = providedField.value;
                            profileField.enabled = providedField.enabled;
                        }
                    }
                }
            }
        }
        // Save the updated profile
        await profile.save();
        logger_1.logger.info(`Profile with content created successfully: ${profile._id}`);
        return profile;
    }
    /**
     * Creates a new profile based on a template
     * @param userId The user ID creating the profile
     * @param templateId The template ID to base the profile on
     * @returns The created profile document
     */
    async createProfile(userId, templateId) {
        logger_1.logger.info(`Creating new profile for user ${userId} using template ${templateId}`);
        // Validate inputs
        if (!(0, mongoose_1.isValidObjectId)(userId) || !(0, mongoose_1.isValidObjectId)(templateId)) {
            throw (0, http_errors_1.default)(400, 'Invalid user ID or template ID');
        }
        // Get the template
        const template = await profile_template_1.ProfileTemplate.findById(templateId);
        if (!template) {
            throw (0, http_errors_1.default)(404, 'Template not found');
        }
        // Check if user already has a profile of this type
        const existingProfile = await profile_model_1.ProfileModel.findOne({
            'profileInformation.creator': userId,
            templatedId: templateId
        });
        if (existingProfile) {
            throw (0, http_errors_1.default)(409, 'User already has a profile using this template');
        }
        // Generate unique links
        const [connectLink, profileLink] = await Promise.all([
            (0, crypto_1.generateUniqueConnectLink)(),
            (0, crypto_1.generateUniqueConnectLink)()
        ]);
        // Generate a unique referral link
        const referralCode = (0, crypto_1.generateReferralCode)();
        const referralLink = `mypts-ref-${referralCode}`;
        // Generate a unique secondary ID
        const secondaryId = await (0, crypto_1.generateSecondaryId)(async (id) => {
            // Check if the ID is unique
            const existingProfile = await profile_model_1.ProfileModel.findOne({ secondaryId: id });
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
        const user = await User_1.User.findById(userId);
        const profileUsername = (user === null || user === void 0 ? void 0 : user.fullName) || (user === null || user === void 0 ? void 0 : user.username) || '';
        // Get country information from user
        const userCountry = (user === null || user === void 0 ? void 0 : user.countryOfResidence) || '';
        // Simple country code mapping for common countries (can be expanded)
        const countryCodeMap = {
            'United States': 'US',
            'Canada': 'CA',
            'United Kingdom': 'GB',
            'Australia': 'AU',
            'Germany': 'DE',
            'France': 'FR',
            'Italy': 'IT',
            'Spain': 'ES',
            'Japan': 'JP',
            'China': 'CN',
            'India': 'IN',
            'Brazil': 'BR',
            'Mexico': 'MX',
            'South Africa': 'ZA',
            'Nigeria': 'NG',
            'Kenya': 'KE',
            'Ghana': 'GH',
            'Cameroon': 'CM'
        };
        const countryCode = countryCodeMap[userCountry] || '';
        // Generate a unique gradient background based on the username
        const { gradient, primaryColor, secondaryColor } = (0, gradient_generator_1.generateProfileGradient)(profileUsername);
        const profile = new profile_model_1.ProfileModel({
            profileCategory: template.profileCategory,
            profileType: template.profileType,
            secondaryId, // Add the secondary ID
            templatedId: template._id,
            profileInformation: {
                username: profileUsername,
                profileLink: profileLink,
                creator: new mongoose_2.default.Types.ObjectId(userId),
                connectLink,
                followLink: profileLink,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            ProfileFormat: {
                profileImage: '', // Initialize with empty string
                customization: {
                    theme: {
                        primaryColor: primaryColor,
                        secondaryColor: secondaryColor,
                        background: gradient,
                    }
                },
                updatedAt: new Date()
            },
            profileLocation: {
                country: userCountry,
                countryCode: countryCode
            },
            ProfileReferal: {
                referalLink: referralLink,
                referals: 0
            },
            sections: initialSections
        });
        await profile.save();
        logger_1.logger.info(`Profile created successfully: ${profile._id}`);
        return profile;
    }
    /**
     * Enables/disables fields in a profile
     * @param profileId The profile ID
     * @param userId The user ID
     * @param enabledFields Array of field keys to enable/disable
     * @returns The updated profile document
     */
    async setEnabledFields(profileId, userId, enabledFields) {
        logger_1.logger.info(`Updating enabled fields for profile ${profileId}`);
        if (!(0, mongoose_1.isValidObjectId)(profileId) || !(0, mongoose_1.isValidObjectId)(userId)) {
            throw (0, http_errors_1.default)(400, 'Invalid profile ID or user ID');
        }
        const profile = await profile_model_1.ProfileModel.findById(profileId);
        if (!profile) {
            throw (0, http_errors_1.default)(404, 'Profile not found');
        }
        // Get user data to check if they're an admin
        const user = await User_1.User.findById(userId);
        // Verify user has permission to update (either creator or admin)
        if (profile.profileInformation.creator.toString() !== userId &&
            (!user || !user.role || !['admin', 'superadmin'].includes(user.role))) {
            throw (0, http_errors_1.default)(403, 'You do not have permission to update this profile');
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
        logger_1.logger.info(`Enabled fields updated for profile ${profileId}`);
        return profile;
    }
    /**
     * Updates profile content for enabled fields
     * @param profileId The profile ID to update
     * @param userId The user ID making the update
     * @param updates Object containing field updates
     * @returns The updated profile document
     */
    async updateProfileContent(profileId, userId, updates) {
        logger_1.logger.info(`Updating content for profile ${profileId}`);
        if (!(0, mongoose_1.isValidObjectId)(profileId) || !(0, mongoose_1.isValidObjectId)(userId)) {
            throw (0, http_errors_1.default)(400, 'Invalid profile ID or user ID');
        }
        const profile = await profile_model_1.ProfileModel.findById(profileId);
        if (!profile) {
            throw (0, http_errors_1.default)(404, 'Profile not found');
        }
        // Get user data to check if they're an admin
        const user = await User_1.User.findById(userId);
        // Verify user has permission to update (either creator or admin)
        if (profile.profileInformation.creator.toString() !== userId &&
            (!user || !user.role || !['admin', 'superadmin'].includes(user.role))) {
            throw (0, http_errors_1.default)(403, 'You do not have permission to update this profile');
        }
        // Get template for validation
        const template = await profile_template_1.ProfileTemplate.findById(profile.templatedId);
        if (!template) {
            throw (0, http_errors_1.default)(404, 'Template not found');
        }
        // Validate and apply updates
        updates.forEach(({ sectionKey, fieldKey, value }) => {
            var _a, _b;
            const section = profile.sections.find(s => s.key === sectionKey);
            if (!section) {
                throw (0, http_errors_1.default)(400, `Invalid section: ${sectionKey}`);
            }
            const field = section.fields.find(f => f.key === fieldKey);
            if (!field) {
                throw (0, http_errors_1.default)(400, `Invalid field: ${fieldKey} in section ${sectionKey}`);
            }
            if (!field.enabled) {
                throw (0, http_errors_1.default)(400, `Field ${fieldKey} is not enabled`);
            }
            // Validate against template field type if needed
            const templateSection = template.categories.find(c => c.name === sectionKey);
            const templateField = templateSection === null || templateSection === void 0 ? void 0 : templateSection.fields.find(f => f.name === fieldKey);
            if (templateField) {
                // Add type-specific validation based on widget type
                switch (templateField.widget) {
                    case 'number':
                        if (typeof value !== 'number') {
                            throw (0, http_errors_1.default)(400, `Field ${fieldKey} must be a number`);
                        }
                        if (((_a = templateField.validation) === null || _a === void 0 ? void 0 : _a.min) !== undefined && value < templateField.validation.min) {
                            throw (0, http_errors_1.default)(400, `Field ${fieldKey} must be at least ${templateField.validation.min}`);
                        }
                        if (((_b = templateField.validation) === null || _b === void 0 ? void 0 : _b.max) !== undefined && value > templateField.validation.max) {
                            throw (0, http_errors_1.default)(400, `Field ${fieldKey} must be at most ${templateField.validation.max}`);
                        }
                        break;
                    case 'email':
                        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                            throw (0, http_errors_1.default)(400, `Field ${fieldKey} must be a valid email`);
                        }
                        break;
                    // Add other validation cases as needed
                }
            }
            // Type assertion to allow value assignment
            field.value = value;
        });
        profile.profileInformation.updatedAt = new Date();
        await profile.save();
        logger_1.logger.info(`Profile content updated for ${profileId}`);
        return profile;
    }
    /**
     * Gets a profile by ID
     * @param profileId The profile ID
     * @returns The profile document
     */
    async getProfile(profileId) {
        logger_1.logger.info(`Fetching profile ${profileId}`);
        if (!(0, mongoose_1.isValidObjectId)(profileId)) {
            throw (0, http_errors_1.default)(400, 'Invalid profile ID');
        }
        const profile = await profile_model_1.ProfileModel.findById(profileId);
        if (!profile) {
            throw (0, http_errors_1.default)(404, 'Profile not found');
        }
        return profile;
    }
    /**
     * Gets all profiles for a user
     * @param userId The user ID
     * @returns Array of profile documents
     */
    async getUserProfiles(userId) {
        logger_1.logger.info(`Fetching all profiles for user ${userId}`);
        if (!(0, mongoose_1.isValidObjectId)(userId)) {
            throw (0, http_errors_1.default)(400, 'Invalid user ID');
        }
        return await profile_model_1.ProfileModel.find({ 'profileInformation.creator': userId });
    }
    /**
     * Gets the first profile for a user (typically used for referral processing)
     * @param userId The user ID
     * @returns The profile document or null if not found
     */
    async getProfileByUserId(userId) {
        logger_1.logger.info(`Fetching first profile for user ${userId}`);
        if (!(0, mongoose_1.isValidObjectId)(userId)) {
            throw (0, http_errors_1.default)(400, 'Invalid user ID');
        }
        return await profile_model_1.ProfileModel.findOne({ 'profileInformation.creator': userId });
    }
    /**
     * Deletes a profile
     * @param profileId The profile ID
     * @param userId The user ID requesting deletion
     * @returns Boolean indicating success
     */
    async deleteProfile(profileId, userId) {
        logger_1.logger.info(`Deleting profile ${profileId} by user ${userId}`);
        if (!(0, mongoose_1.isValidObjectId)(profileId) || !(0, mongoose_1.isValidObjectId)(userId)) {
            throw (0, http_errors_1.default)(400, 'Invalid profile ID or user ID');
        }
        const profile = await profile_model_1.ProfileModel.findById(profileId);
        if (!profile) {
            throw (0, http_errors_1.default)(404, 'Profile not found');
        }
        // Get user data to check if they're an admin
        const user = await User_1.User.findById(userId);
        // Verify user has permission to delete (either creator or admin)
        if (profile.profileInformation.creator.toString() !== userId &&
            (!user || !user.role || !['admin', 'superadmin'].includes(user.role))) {
            throw (0, http_errors_1.default)(403, 'You do not have permission to delete this profile');
        }
        const result = await profile_model_1.ProfileModel.deleteOne({ _id: profileId });
        return result.deletedCount > 0;
    }
    /**
     * Get all profiles with pagination and filtering (admin only)
     * @param filter Filter criteria
     * @param skip Number of documents to skip
     * @param limit Maximum number of documents to return
     * @returns Array of profile documents
     */
    async getAllProfiles(filter = {}, skip = 0, limit = 20) {
        logger_1.logger.info(`Fetching all profiles with filter: ${JSON.stringify(filter)}, skip: ${skip}, limit: ${limit}`);
        let query = profile_model_1.ProfileModel.find(filter).sort({ 'profileInformation.createdAt': -1 });
        if (limit > 0) {
            query = query.skip(skip).limit(limit);
        }
        else {
            // If limit is 0 or negative, do not apply limit (return all)
            if (skip > 0) {
                query = query.skip(skip);
            }
            // No .limit() call, so all profiles are returned
        }
        return await query;
    }
    /**
     * Count profiles matching a filter
     * @param filter Filter criteria
     * @returns Count of matching profiles
     */
    async countProfiles(filter = {}) {
        logger_1.logger.info(`Counting profiles with filter: ${JSON.stringify(filter)}`);
        return await profile_model_1.ProfileModel.countDocuments(filter);
    }
    /**
     * Updates a profile's username and description
     * @param profileId The profile ID to update
     * @param userId The user ID making the update
     * @param username The new username for the profile
     * @param description Optional description for the profile
     * @returns The updated profile document
     */
    async updateProfileBasicInfo(profileId, userId, username, description) {
        logger_1.logger.info(`Updating basic info for profile ${profileId}`);
        if (!(0, mongoose_1.isValidObjectId)(profileId) || !(0, mongoose_1.isValidObjectId)(userId)) {
            throw (0, http_errors_1.default)(400, 'Invalid profile ID or user ID');
        }
        if (!username || username.trim() === '') {
            throw (0, http_errors_1.default)(400, 'Username is required');
        }
        const profile = await profile_model_1.ProfileModel.findById(profileId);
        if (!profile) {
            throw (0, http_errors_1.default)(404, 'Profile not found');
        }
        // Get user data to check if they're an admin and for fullName
        const user = await User_1.User.findById(userId);
        if (!user) {
            throw (0, http_errors_1.default)(404, 'User not found');
        }
        // Verify user has permission to update (either creator or admin)
        if (profile.profileInformation.creator.toString() !== userId &&
            (!user.role || !['admin', 'superadmin'].includes(user.role))) {
            throw (0, http_errors_1.default)(403, 'You do not have permission to update this profile');
        }
        // Update the profile username with the provided username
        profile.profileInformation.username = username;
        profile.profileInformation.updatedAt = new Date();
        // If description is provided, update it using the updateProfileContent method
        if (description !== undefined) {
            try {
                // Find the basic section that contains the bio/description field
                const basicSection = profile.sections.find(s => s.key === 'basic' ||
                    s.fields.some(f => f.key === 'bio' || f.key === 'description'));
                if (basicSection) {
                    // Find the bio/description field
                    const bioField = basicSection.fields.find(f => f.key === 'bio' || f.key === 'description');
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
                        logger_1.logger.info(`Updated description for profile ${profileId}`);
                    }
                    else {
                        logger_1.logger.warn(`Could not find bio/description field in profile ${profileId}`);
                    }
                }
                else {
                    // If the section doesn't exist, we can't add the description
                    logger_1.logger.warn(`Could not find basic section in profile ${profileId} to update description`);
                }
            }
            catch (error) {
                logger_1.logger.error(`Error updating description for profile ${profileId}:`, error);
                // Don't throw the error to avoid disrupting the username update
            }
        }
        await profile.save();
        logger_1.logger.info(`Basic info updated for profile ${profileId}`);
        return profile;
    }
    /**
     * Creates a default personal profile for a new user
     * @param userId The user ID
     * @param userObject Optional user object to avoid additional database query
     * @returns The created profile document
     */
    async createDefaultProfile(userId, userObject) {
        logger_1.logger.info(`Creating default personal profile for user ${userId}`);
        // Get user data - use provided user object if available to avoid race conditions
        const user = userObject || await User_1.User.findById(userId);
        if (!user) {
            throw (0, http_errors_1.default)(404, 'User not found');
        }
        // Get the default personal profile template
        let template = await profile_template_1.ProfileTemplate.findOne({
            profileType: 'personal',
            profileCategory: 'individual'
        });
        // If template doesn't exist, create it
        if (!template) {
            logger_1.logger.info('Default personal profile template not found, creating one...');
            // Create a default admin ID (this is required by the schema)
            const adminId = new mongoose_2.default.Types.ObjectId();
            // Create the default personal profile template
            template = await profile_template_1.ProfileTemplate.create({
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
            logger_1.logger.info(`Created default personal profile template: ${template._id}`);
        }
        const templateId = template.toJSON()._id.toString();
        // Create the profile
        const profile = await this.createProfile(userId, templateId);
        // Initialize referral code for the new profile
        try {
            const { ProfileReferralService } = require('./profile-referral.service');
            await ProfileReferralService.initializeReferralCode(profile._id);
            logger_1.logger.info(`Initialized referral code for profile: ${profile._id}`);
        }
        catch (error) {
            logger_1.logger.error(`Error initializing referral code for profile ${profile._id}:`, error);
            // Don't throw the error to avoid disrupting the profile creation process
        }
        // Add profile to user's profiles array
        await User_1.User.findByIdAndUpdate(userId, {
            $addToSet: { profiles: profile._id }
        });
        // Create a referral record for the profile
        try {
            const { ProfileReferralService } = require('./profile-referral.service');
            await ProfileReferralService.getProfileReferral(profile._id);
            logger_1.logger.info(`Created referral record for profile: ${profile._id}`);
            // Check if the user was referred (has a valid referral code)
            // Always check for referral code, whether from normal registration or social auth
            // First check for temporary referral code (from registration process)
            // Important: We prioritize tempReferralCode over referralCode because referralCode might be the user's own code
            const referralCode = user.tempReferralCode;
            logger_1.logger.info(`Checking referral code for user ${userId}: ${referralCode}`);
            // Log the entire user object for debugging
            logger_1.logger.info(`User object for debugging: ${JSON.stringify({
                id: user._id,
                email: user.email,
                referralCode: user.referralCode,
                tempReferralCode: user.tempReferralCode
            })}`);
            if (referralCode && typeof referralCode === 'string' && referralCode.trim() !== '') {
                try {
                    // Validate the referral code
                    const referringProfileId = await ProfileReferralService.validateReferralCode(referralCode);
                    if (referringProfileId) {
                        // Process the referral and retry if it fails initially
                        let referralProcessed = await ProfileReferralService.processReferral(profile._id, referringProfileId);
                        // If first attempt fails, wait briefly and retry once
                        if (!referralProcessed) {
                            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
                            referralProcessed = await ProfileReferralService.processReferral(profile._id, referringProfileId);
                        }
                        if (referralProcessed) {
                            logger_1.logger.info(`Successfully processed referral for profile ${profile._id} with referral code ${referralCode}`);
                            // Initialize referral record for the new profile
                            await ProfileReferralService.initializeReferralCode(profile._id);
                        }
                        else {
                            logger_1.logger.error(`Failed to process referral for profile ${profile._id} with referral code ${referralCode} after retry`);
                        }
                    }
                    else {
                        logger_1.logger.warn(`Invalid referral code provided: ${referralCode}`);
                    }
                }
                catch (referralError) {
                    logger_1.logger.error(`Error processing referral for profile ${profile._id}:`, referralError);
                    // Continue profile creation even if referral processing fails
                }
            }
            else {
                logger_1.logger.info(`No referral code found for user ${userId}`);
            }
        }
        catch (error) {
            logger_1.logger.error(`Error creating referral record for profile ${profile._id}:`, error);
            // Don't throw the error to avoid disrupting the profile creation process
        }
        return profile;
    }
    /**
     * Set profile availability
     */
    async setAvailability(profileId, availabilityData) {
        const profile = await this.getProfile(profileId);
        if (!profile) {
            throw (0, http_errors_1.default)(404, 'Profile not found');
        }
        // Convert profile to document to access methods
        const profileDoc = profile;
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
    async updateAvailability(profileId, updates) {
        const profile = await this.getProfile(profileId);
        if (!profile) {
            throw (0, http_errors_1.default)(404, 'Profile not found');
        }
        // Convert profile to document to access methods
        const profileDoc = profile;
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
        if (updates.defaultDuration)
            profileDoc.availability.defaultDuration = updates.defaultDuration;
        if (updates.bufferTime)
            profileDoc.availability.bufferTime = updates.bufferTime;
        if (updates.workingHours)
            profileDoc.availability.workingHours = updates.workingHours;
        if (updates.exceptions)
            profileDoc.availability.exceptions = updates.exceptions;
        if (updates.bookingWindow)
            profileDoc.availability.bookingWindow = updates.bookingWindow;
        if (updates.breakTime) {
            // Ensure breakTime days are properly formatted strings
            profileDoc.availability.breakTime = updates.breakTime.map((breakTime) => ({
                start: breakTime.start,
                end: breakTime.end,
                days: breakTime.days.map((day) => day.charAt(0).toUpperCase() + day.slice(1).toLowerCase())
            }));
        }
        if (updates.isAvailable !== undefined)
            profileDoc.availability.isAvailable = updates.isAvailable;
        await profileDoc.save();
        return profileDoc.availability;
    }
    /**
     * Get profile availability
     */
    async getAvailability(profileId) {
        const profile = await this.getProfile(profileId);
        if (!profile) {
            throw (0, http_errors_1.default)(404, 'Profile not found');
        }
        return profile.availability;
    }
    /**
     * Get available slots for a specific date
     */
    async getAvailableSlots(profileId, date) {
        var _a, _b, _c;
        const profile = await this.getProfile(profileId);
        if (!profile) {
            throw new Error('Profile not found');
        }
        if (!((_a = profile.availability) === null || _a === void 0 ? void 0 : _a.isAvailable)) {
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
        if (!(workingHours === null || workingHours === void 0 ? void 0 : workingHours.isWorking)) {
            console.log('Debug - Not a working day');
            return [];
        }
        const dateStr = date.toISOString().split('T')[0];
        const slots = [];
        // Check for exceptions
        const exception = (_b = profile.availability.exceptions) === null || _b === void 0 ? void 0 : _b.find(e => e.date.toISOString().split('T')[0] === dateStr);
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
                const isInBreakTime = (_c = profile.availability.breakTime) === null || _c === void 0 ? void 0 : _c.some(breakTime => {
                    if (!breakTime.days.includes(dayOfWeek))
                        return false;
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
}
exports.ProfileService = ProfileService;
