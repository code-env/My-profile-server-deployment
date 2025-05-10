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
const mongoose_2 = __importDefault(require("mongoose"));
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
        // Get user data for username
        const user = await User_1.User.findById(userId);
        const username = (user === null || user === void 0 ? void 0 : user.username) || '';
        const profile = new profile_model_1.ProfileModel({
            profileCategory: template.profileCategory,
            profileType: template.profileType,
            secondaryId, // Add the secondary ID
            templatedId: template._id,
            profileInformation: {
                username: username,
                profileLink: profileLink,
                creator: new mongoose_2.default.Types.ObjectId(userId),
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
        // Verify user has permission to update
        if (profile.profileInformation.creator.toString() !== userId) {
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
        // Verify user has permission to update
        if (profile.profileInformation.creator.toString() !== userId) {
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
        if (profile.profileInformation.creator.toString() !== userId) {
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
        return await profile_model_1.ProfileModel.find(filter)
            .sort({ 'profileInformation.createdAt': -1 })
            .skip(skip)
            .limit(limit);
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
     * Creates a default personal profile for a new user
     * @param userId The user ID
     * @returns The created profile document
     */
    async createDefaultProfile(userId) {
        logger_1.logger.info(`Creating default personal profile for user ${userId}`);
        // Get user data
        const user = await User_1.User.findById(userId);
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
            if (user.referralCode && typeof user.referralCode === 'string' && user.referralCode.trim() !== '') {
                try {
                    // Validate the referral code
                    const referringProfileId = await ProfileReferralService.validateReferralCode(user.referralCode);
                    if (referringProfileId) {
                        // Process the referral
                        const referralProcessed = await ProfileReferralService.processReferral(profile._id, referringProfileId);
                        if (referralProcessed) {
                            logger_1.logger.info(`Successfully processed referral for profile ${profile._id} with referral code ${user.referralCode}`);
                        }
                        else {
                            logger_1.logger.warn(`Failed to process referral for profile ${profile._id} with referral code ${user.referralCode}`);
                        }
                    }
                    else {
                        logger_1.logger.info(`Referral code ${user.referralCode} is invalid or not found, skipping referral processing`);
                    }
                }
                catch (referralError) {
                    logger_1.logger.error(`Error processing referral for profile ${profile._id}:`, referralError);
                    // Don't throw the error to avoid disrupting the profile creation process
                }
            }
            else {
                logger_1.logger.info(`No valid referral code found for user ${userId}, skipping referral processing`);
            }
        }
        catch (error) {
            logger_1.logger.error(`Error creating referral record for profile ${profile._id}:`, error);
            // Don't throw the error to avoid disrupting the profile creation process
        }
        return profile;
    }
}
exports.ProfileService = ProfileService;
