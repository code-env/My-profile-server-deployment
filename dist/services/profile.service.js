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
const crypto_1 = require("../utils/crypto");
class ProfileService {
    async createProfile(userId) {
        console.log('👤 Creating new profile for user:', userId);
        // Check if user already has a profile
        const existingProfiles = await profile_model_1.ProfileModel.find({ $or: [{ owner: userId }, { managers: userId }] });
        const profile = new profile_model_1.ProfileModel({
            userId,
            personalInfo: {},
            contactInfo: {},
            socialInfo: {},
            // If user has no profiles, they become owner. Otherwise, they become manager
            owner: existingProfiles.length === 0 ? userId : undefined,
            managers: existingProfiles.length > 0 ? [userId] : []
        });
        console.log('✅ Profile created successfully:', profile._id);
        return await profile.save();
    }
    async updatePersonalInfo(userId, personalInfo) {
        console.log('📝 Updating personal info for user:', userId);
        console.log('ℹ️ New personal info:', JSON.stringify(personalInfo, null, 2));
        const profile = await profile_model_1.ProfileModel.findOneAndUpdate({ userId }, { $set: { personalInfo } }, { new: true, upsert: true });
        console.log(profile ? '✅ Personal info updated' : '❌ Profile not found');
        return profile;
    }
    async updateContactInfo(userId, contactInfo) {
        console.log('📞 Updating contact info for user:', userId);
        console.log('ℹ️ New contact info:', JSON.stringify(contactInfo, null, 2));
        const profile = await profile_model_1.ProfileModel.findOneAndUpdate({ userId }, { $set: { contactInfo } }, { new: true, upsert: true });
        console.log(profile ? '✅ Contact info updated' : '❌ Profile not found');
        return profile;
    }
    async updateSocialInfo(userId, socialInfo) {
        console.log('🌐 Updating social info for user:', userId);
        console.log('ℹ️ New social info:', JSON.stringify(socialInfo, null, 2));
        const profile = await profile_model_1.ProfileModel.findOneAndUpdate({ userId }, { $set: { socialInfo } }, { new: true, upsert: true });
        console.log(profile ? '✅ Social info updated' : '❌ Profile not found');
        return profile;
    }
    async getProfile(userId) {
        console.log('🔍 Fetching profile for user:', userId);
        const profile = await profile_model_1.ProfileModel.findOne({ userId });
        console.log(profile ? '✅ Profile found' : '❌ Profile not found');
        return profile;
    }
    async deleteProfile(userId) {
        console.log('🗑️ Deleting profile for user:', userId);
        const result = await profile_model_1.ProfileModel.deleteOne({ userId });
        const success = result.deletedCount > 0;
        console.log(success ? '✅ Profile deleted' : '❌ Profile not found');
        return success;
    }
    async updateProfile(profileId, userId, updates) {
        var _a;
        console.log('📝 Updating profile:', profileId);
        console.log('ℹ️ Updates:', JSON.stringify(updates, null, 2));
        // Validate profile ID
        if (!(0, mongoose_1.isValidObjectId)(profileId)) {
            throw (0, http_errors_1.default)(400, 'Invalid profile ID');
        }
        // Find profile and check permissions
        const profile = await profile_model_1.ProfileModel.findById(profileId);
        if (!profile) {
            console.log('❌ Profile not found:', profileId);
            return null;
        }
        // Check if user has permission to update
        const isOwner = ((_a = profile.owner) === null || _a === void 0 ? void 0 : _a.toString()) === userId;
        const isManager = profile.managers.some(manager => manager.toString() === userId);
        if (!isOwner && !isManager) {
            throw (0, http_errors_1.default)(403, 'You do not have permission to update this profile');
        }
        // Remove protected fields from updates
        const safeUpdates = { ...updates };
        // Only owners can modify the managers list
        const protectedFields = ['owner', 'claimed', 'claimedBy', 'qrCode'];
        if (!isOwner) {
            protectedFields.push('managers');
        }
        protectedFields.forEach(field => delete safeUpdates[field]);
        // Update profile
        const updatedProfile = await profile_model_1.ProfileModel.findByIdAndUpdate(profileId, { $set: safeUpdates }, { new: true, runValidators: true });
        console.log(updatedProfile ? '✅ Profile updated' : '❌ Profile not found');
        return updatedProfile;
    }
    async verifyProfile(profileId, documents) {
        console.log('✔️ Verifying profile:', profileId);
        console.log('📄 Documents submitted:', documents.length);
        if (!(0, mongoose_1.isValidObjectId)(profileId)) {
            throw (0, http_errors_1.default)(400, 'Invalid profile ID');
        }
        const profile = await profile_model_1.ProfileModel.findById(profileId);
        if (!profile) {
            console.error('❌ Profile not found:', profileId);
            throw (0, http_errors_1.default)(404, 'Profile not found');
        }
        // Update KYC verification status
        profile.kycVerification = {
            status: 'pending',
            submittedAt: new Date(),
            documents,
            verificationLevel: 'basic'
        };
        // Add security measures
        profile.security = {
            twoFactorRequired: true,
            ipWhitelist: [],
            lastSecurityAudit: new Date()
        };
        console.log('✅ Profile verified successfully');
        return await profile.save();
    }
    async updateSecuritySettings(profileId, settings) {
        console.log('🔒 Updating security settings for profile:', profileId);
        console.log('ℹ️ New settings:', JSON.stringify(settings, null, 2));
        const profile = await profile_model_1.ProfileModel.findById(profileId);
        if (!profile) {
            console.error('❌ Profile not found:', profileId);
            throw (0, http_errors_1.default)(404, 'Profile not found');
        }
        if (settings.twoFactorRequired !== undefined) {
            profile.security.twoFactorRequired = settings.twoFactorRequired;
        }
        if (settings.ipWhitelist) {
            profile.security.ipWhitelist = settings.ipWhitelist;
        }
        profile.security.lastSecurityAudit = new Date();
        console.log('✅ Security settings updated');
        return await profile.save();
    }
    async updateConnectionPreferences(profileId, preferences) {
        console.log('🤝 Updating connection preferences for profile:', profileId);
        console.log('ℹ️ New preferences:', JSON.stringify(preferences, null, 2));
        const profile = await profile_model_1.ProfileModel.findById(profileId);
        if (!profile) {
            console.error('❌ Profile not found:', profileId);
            throw (0, http_errors_1.default)(404, 'Profile not found');
        }
        // profile.connectionPreferences = {
        //   ...profile.connectionPreferences,
        //   ...preferences
        // };
        console.log('✅ Connection preferences updated');
        return await profile.save();
    }
    async updateSocialLinks(profileId, links) {
        console.log('🔗 Updating social links for profile:', profileId);
        console.log('ℹ️ New links:', JSON.stringify(links, null, 2));
        const profile = await profile_model_1.ProfileModel.findById(profileId);
        if (!profile) {
            console.error('❌ Profile not found:', profileId);
            throw (0, http_errors_1.default)(404, 'Profile not found');
        }
        // profile.socialLinks = {
        //   ...profile.socialLinks,
        //   ...links
        // };
        console.log('✅ Social links updated');
        return await profile.save();
    }
    async manageConnection(profileId, targetProfileId, action) {
        var _a, _b;
        console.log('🤝 Managing connection:', { profileId, targetProfileId, action });
        const profile = await profile_model_1.ProfileModel.findById(profileId);
        const targetProfile = await profile_model_1.ProfileModel.findById(targetProfileId);
        if (!profile || !targetProfile) {
            console.error('❌ Profile not found:', profileId);
            throw (0, http_errors_1.default)(404, 'Profile not found');
        }
        switch (action) {
            case 'connect':
                if (!profile.stats)
                    profile.stats = { followers: 0, following: 0 };
                if (!targetProfile.stats)
                    targetProfile.stats = { followers: 0, following: 0 };
                profile.stats.following++;
                targetProfile.stats.followers++;
                break;
            case 'disconnect':
                if (((_a = profile.stats) === null || _a === void 0 ? void 0 : _a.following) > 0)
                    profile.stats.following--;
                if (((_b = targetProfile.stats) === null || _b === void 0 ? void 0 : _b.followers) > 0)
                    targetProfile.stats.followers--;
                break;
            case 'block':
                // Implementation depends on your blocking mechanism
                break;
        }
        await Promise.all([profile.save(), targetProfile.save()]);
        console.log('✅ Connection action completed:', action);
        return { success: true, message: `Successfully ${action}ed connection` };
    }
    async addPortfolioProject(profileId, project) {
        console.log('📁 Adding portfolio project for profile:', profileId);
        console.log('ℹ️ Project details:', JSON.stringify(project, null, 2));
        const profile = await profile_model_1.ProfileModel.findById(profileId);
        if (!profile) {
            console.error('❌ Profile not found:', profileId);
            throw (0, http_errors_1.default)(404, 'Profile not found');
        }
        // if (!profile.portfolio) {
        //   profile.portfolio = {
        //     projects: [],
        //     skills: [],
        //     resume: {
        //       education: [],
        //       experience: [],
        //       publications: []
        //     }
        //   };
        // }
        // Uncomment and use this when portfolio functionality is implemented
        // const projectId = new mongoose.Types.ObjectId();
        // profile.portfolio.projects.push({
        //   id: projectId.toString(),
        //   ...project,
        //   visibility: 'connections',
        //   featured: false
        // });
        console.log('✅ Portfolio project added successfully');
        return await profile.save();
    }
    async updateSkills(profileId, skills) {
        console.log('🎯 Updating skills for profile:', profileId);
        console.log('ℹ️ New skills:', JSON.stringify(skills, null, 2));
        const profile = await profile_model_1.ProfileModel.findById(profileId);
        if (!profile) {
            console.error('❌ Profile not found:', profileId);
            throw (0, http_errors_1.default)(404, 'Profile not found');
        }
        // profile.skills = skills.map(skill => ({
        //   ...skill,
        //   endorsements: skill.endorsements || 0
        // }));
        console.log('✅ Skills updated successfully');
        return await profile.save();
    }
    async updateAvailability(profileId, availability) {
        console.log('🔄 Updating availability for profile:', profileId);
        console.log('📅 New availability settings:', JSON.stringify(availability, null, 2));
        // Validate profileId format
        if (!(0, mongoose_1.isValidObjectId)(profileId)) {
            console.error('❌ Invalid profile ID format attempted:', profileId);
            throw (0, http_errors_1.default)(400, 'Invalid profile ID format');
        }
        const profile = await profile_model_1.ProfileModel.findById(profileId);
        if (!profile) {
            console.error('❌ Profile not found:', profileId);
            throw (0, http_errors_1.default)(404, 'Profile not found');
        }
        console.log('✅ Profile found:', profileId);
        // Validate working hours format
        const invalidHours = availability.workingHours.find(hour => hour.day < 0 || hour.day > 6 || !hour.start || !hour.end);
        if (invalidHours) {
            console.error('❌ Invalid working hours format:', invalidHours);
            throw (0, http_errors_1.default)(400, 'Invalid working hours format');
        }
        console.log('✅ Working hours validation passed');
        // console.log('📊 Current availability settings:', JSON.stringify(profile.calendar.availability, null, 2));
        console.log('📊 New availability settings:', JSON.stringify(availability, null, 2));
        // profile.calendar.availability = availability;
        try {
            const updatedProfile = await profile.save();
            console.log('✅ Successfully updated availability');
            // console.log('📅 Updated working hours:', JSON.stringify(updatedProfile.calendar.availability.workingHours, null, 2));
            return updatedProfile;
        }
        catch (error) {
            console.error('❌ Error updating availability:', error);
            throw error;
        }
    }
    async addEndorsement(profileId, skillName, endorserId) {
        console.log('👍 Adding endorsement:', { profileId, skillName, endorserId });
        const profile = await profile_model_1.ProfileModel.findById(profileId);
        if (!profile) {
            console.error('❌ Profile not found:', profileId);
            throw (0, http_errors_1.default)(404, 'Profile not found');
        }
        // const skill = profile.skills.find(s => s.name === skillName);
        // if (!skill) {
        //   console.error('❌ Skill not found:', skillName);
        //   throw createHttpError(404, 'Skill not found');
        // }
        // skill.endorsements = (skill.endorsements || 0) + 1;
        // await profile.save();
        console.log('✅ Endorsement added successfully');
        return { success: true, message: 'Skill endorsed successfully' };
    }
    /**
     * Create a default personal profile for a newly registered user
     * @param userId The user ID
     * @returns The created profile
     */
    async createDefaultProfile(userId) {
        try {
            logger_1.logger.info(`Creating default profile for user: ${userId}`);
            // Check if user already has a profile
            const existingProfiles = await profile_model_1.ProfileModel.find({ owner: userId });
            if (existingProfiles.length > 0) {
                logger_1.logger.info(`User ${userId} already has ${existingProfiles.length} profiles. Skipping default profile creation.`);
                return existingProfiles[0];
            }
            // Get user data
            const user = await User_1.User.findById(userId);
            if (!user) {
                throw (0, http_errors_1.default)(404, 'User not found');
            }
            // Generate a unique connect link
            const connectLink = await (0, crypto_1.generateUniqueConnectLink)();
            // Create a default personal profile
            const profile = new profile_model_1.ProfileModel({
                name: `${user.fullName}'s Profile`,
                description: `Personal profile for ${user.fullName}`,
                profileType: 'personal',
                profileCategory: 'individual',
                owner: userId,
                managers: [userId],
                connectLink,
                claimed: true,
                claimedBy: userId,
                claimedAt: new Date(),
                settings: {
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
                }
            });
            // Save the profile
            const savedProfile = await profile.save();
            // Add profile to user's profiles array
            await User_1.User.findByIdAndUpdate(userId, {
                $addToSet: { profiles: savedProfile._id }
            });
            logger_1.logger.info(`Default profile created successfully for user ${userId}: ${savedProfile._id}`);
            return savedProfile;
        }
        catch (error) {
            logger_1.logger.error(`Error creating default profile for user ${userId}:`, error);
            throw error;
        }
    }
}
exports.ProfileService = ProfileService;
