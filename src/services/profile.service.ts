import { ProfileModel, ProfileDocument } from '../models/profile.model';
import { Profile, PersonalInfo, ContactInfo, SocialInfo } from '../types/profile.types';
import mongoose, { isValidObjectId } from 'mongoose';
import createHttpError from 'http-errors';
import { logger } from '../utils/logger';

export class ProfileService {
  async createProfile(userId: string): Promise<ProfileDocument> {
    console.log('👤 Creating new profile for user:', userId);
    // Check if user already has a profile
    const existingProfiles = await ProfileModel.find({ $or: [{ owner: userId }, { managers: userId }] });
    
    const profile = new ProfileModel({
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

  async updatePersonalInfo(userId: string, personalInfo: Partial<PersonalInfo>): Promise<ProfileDocument | null> {
    console.log('📝 Updating personal info for user:', userId);
    console.log('ℹ️ New personal info:', JSON.stringify(personalInfo, null, 2));
    const profile = await ProfileModel.findOneAndUpdate(
      { userId },
      { $set: { personalInfo } },
      { new: true, upsert: true }
    );
    console.log(profile ? '✅ Personal info updated' : '❌ Profile not found');
    return profile;
  }

  async updateContactInfo(userId: string, contactInfo: Partial<ContactInfo>): Promise<ProfileDocument | null> {
    console.log('📞 Updating contact info for user:', userId);
    console.log('ℹ️ New contact info:', JSON.stringify(contactInfo, null, 2));
    const profile = await ProfileModel.findOneAndUpdate(
      { userId },
      { $set: { contactInfo } },
      { new: true, upsert: true }
    );
    console.log(profile ? '✅ Contact info updated' : '❌ Profile not found');
    return profile;
  }

  async updateSocialInfo(userId: string, socialInfo: Partial<SocialInfo>): Promise<ProfileDocument | null> {
    console.log('🌐 Updating social info for user:', userId);
    console.log('ℹ️ New social info:', JSON.stringify(socialInfo, null, 2));
    const profile = await ProfileModel.findOneAndUpdate(
      { userId },
      { $set: { socialInfo } },
      { new: true, upsert: true }
    );
    console.log(profile ? '✅ Social info updated' : '❌ Profile not found');
    return profile;
  }

  async getProfile(userId: string): Promise<ProfileDocument | null> {
    console.log('🔍 Fetching profile for user:', userId);
    const profile = await ProfileModel.findOne({ userId });
    console.log(profile ? '✅ Profile found' : '❌ Profile not found');
    return profile;
  }

  async deleteProfile(userId: string): Promise<boolean> {
    console.log('🗑️ Deleting profile for user:', userId);
    const result = await ProfileModel.deleteOne({ userId });
    const success = result.deletedCount > 0;
    console.log(success ? '✅ Profile deleted' : '❌ Profile not found');
    return success;
  }

  async updateProfile(
    profileId: string,
    userId: string,
    updates: Partial<Profile>
  ): Promise<ProfileDocument | null> {
    console.log('📝 Updating profile:', profileId);
    console.log('ℹ️ Updates:', JSON.stringify(updates, null, 2));
    // Validate profile ID
    if (!isValidObjectId(profileId)) {
      throw createHttpError(400, 'Invalid profile ID');
    }

    // Find profile and check permissions
    const profile = await ProfileModel.findById(profileId);
    if (!profile) {
      console.log('❌ Profile not found:', profileId);
      return null;
    }

    // Check if user has permission to update
    const isOwner = profile.owner?.toString() === userId;
    const isManager = profile.managers.some(manager => manager.toString() === userId);
    
    if (!isOwner && !isManager) {
      throw createHttpError(403, 'You do not have permission to update this profile');
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
    const updatedProfile = await ProfileModel.findByIdAndUpdate(
      profileId,
      { $set: safeUpdates },
      { new: true, runValidators: true }
    );
    console.log(updatedProfile ? '✅ Profile updated' : '❌ Profile not found');
    return updatedProfile;
  }

  async verifyProfile(profileId: string, documents: any[]): Promise<ProfileDocument> {
    console.log('✔️ Verifying profile:', profileId);
    console.log('📄 Documents submitted:', documents.length);
    if (!isValidObjectId(profileId)) {
      throw createHttpError(400, 'Invalid profile ID');
    }

    const profile = await ProfileModel.findById(profileId);
    if (!profile) {
      console.error('❌ Profile not found:', profileId);
      throw createHttpError(404, 'Profile not found');
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

  async updateSecuritySettings(
    profileId: string, 
    settings: { 
      twoFactorRequired?: boolean; 
      ipWhitelist?: string[]; 
    }
  ): Promise<ProfileDocument> {
    console.log('🔒 Updating security settings for profile:', profileId);
    console.log('ℹ️ New settings:', JSON.stringify(settings, null, 2));
    const profile = await ProfileModel.findById(profileId);
    if (!profile) {
      console.error('❌ Profile not found:', profileId);
      throw createHttpError(404, 'Profile not found');
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

  async updateConnectionPreferences(
    profileId: string,
    preferences: {
      allowFollowers?: boolean;
      allowEmployment?: boolean;
      allowDonations?: boolean;
      allowCollaboration?: boolean;
      connectionPrivacy?: 'public' | 'private' | 'mutual';
      connectionApproval?: 'automatic' | 'manual' | 'verified-only';
    }
  ): Promise<ProfileDocument> {
    console.log('🤝 Updating connection preferences for profile:', profileId);
    console.log('ℹ️ New preferences:', JSON.stringify(preferences, null, 2));
    const profile = await ProfileModel.findById(profileId);
    if (!profile) {
      console.error('❌ Profile not found:', profileId);
      throw createHttpError(404, 'Profile not found');
    }

    profile.connectionPreferences = {
      ...profile.connectionPreferences,
      ...preferences
    };

    console.log('✅ Connection preferences updated');
    return await profile.save();
  }

  async updateSocialLinks(
    profileId: string,
    links: {
      website?: string;
      facebook?: string;
      twitter?: string;
      instagram?: string;
      linkedin?: string;
      github?: string;
      youtube?: string;
      tiktok?: string;
    }
  ): Promise<ProfileDocument> {
    console.log('🔗 Updating social links for profile:', profileId);
    console.log('ℹ️ New links:', JSON.stringify(links, null, 2));
    const profile = await ProfileModel.findById(profileId);
    if (!profile) {
      console.error('❌ Profile not found:', profileId);
      throw createHttpError(404, 'Profile not found');
    }

    profile.socialLinks = {
      ...profile.socialLinks,
      ...links
    };

    console.log('✅ Social links updated');
    return await profile.save();
  }

  async manageConnection(
    profileId: string,
    targetProfileId: string,
    action: 'connect' | 'disconnect' | 'block'
  ): Promise<{ success: boolean; message: string }> {
    console.log('🤝 Managing connection:', { profileId, targetProfileId, action });
    const profile = await ProfileModel.findById(profileId);
    const targetProfile = await ProfileModel.findById(targetProfileId);

    if (!profile || !targetProfile) {
      console.error('❌ Profile not found:', profileId);
      throw createHttpError(404, 'Profile not found');
    }

    switch (action) {
      case 'connect':
        if (!profile.stats) profile.stats = { followers: 0, following: 0 } as any;
        if (!targetProfile.stats) targetProfile.stats = { followers: 0, following: 0 } as any;
        
        profile.stats.following++;
        targetProfile.stats.followers++;
        break;

      case 'disconnect':
        if (profile.stats?.following > 0) profile.stats.following--;
        if (targetProfile.stats?.followers > 0) targetProfile.stats.followers--;
        break;

      case 'block':
        // Implementation depends on your blocking mechanism
        break;
    }

    await Promise.all([profile.save(), targetProfile.save()]);
    console.log('✅ Connection action completed:', action);
    return { success: true, message: `Successfully ${action}ed connection` };
  }

  async addPortfolioProject(
    profileId: string,
    project: {
      title: string;
      description: string;
      shortDescription: string;
      thumbnail: string;
      images: string[];
      videos?: string[];
      category: string;
      tags: string[];
      technologies: string[];
      url?: string;
      githubUrl?: string;
      startDate: Date;
      endDate?: Date;
      status: 'in-progress' | 'completed' | 'on-hold';
    }
  ): Promise<ProfileDocument> {
    console.log('📁 Adding portfolio project for profile:', profileId);
    console.log('ℹ️ Project details:', JSON.stringify(project, null, 2));
    const profile = await ProfileModel.findById(profileId);
    if (!profile) {
      console.error('❌ Profile not found:', profileId);
      throw createHttpError(404, 'Profile not found');
    }

    if (!profile.portfolio) {
      profile.portfolio = {
        projects: [],
        skills: [],
        resume: {
          education: [],
          experience: [],
          publications: []
        }
      };
    }

    const projectId = new mongoose.Types.ObjectId();
    profile.portfolio.projects.push({
      id: projectId.toString(),
      ...project,
      visibility: 'connections',
      featured: false
    });

    console.log('✅ Portfolio project added successfully');
    return await profile.save();
  }

  async updateSkills(
    profileId: string,
    skills: Array<{
      name: string;
      level: 'beginner' | 'intermediate' | 'expert';
      endorsements?: number;
    }>
  ): Promise<ProfileDocument> {
    console.log('🎯 Updating skills for profile:', profileId);
    console.log('ℹ️ New skills:', JSON.stringify(skills, null, 2));
    const profile = await ProfileModel.findById(profileId);
    if (!profile) {
      console.error('❌ Profile not found:', profileId);
      throw createHttpError(404, 'Profile not found');
    }

    profile.skills = skills.map(skill => ({
      ...skill,
      endorsements: skill.endorsements || 0
    }));

    console.log('✅ Skills updated successfully');
    return await profile.save();
  }

  async updateAvailability(
    profileId: string,
    availability: {
      status: 'available' | 'busy' | 'away';
      workingHours: Array<{
        day: number;
        start: string;
        end: string;
        available: boolean;
      }>;
      timeZone: string;
      bufferTime: number;
      defaultMeetingDuration: number;
    }
  ): Promise<ProfileDocument> {
    console.log('🔄 Updating availability for profile:', profileId);
    console.log('📅 New availability settings:', JSON.stringify(availability, null, 2));

    // Validate profileId format
    if (!isValidObjectId(profileId)) {
      console.error('❌ Invalid profile ID format attempted:', profileId);
      throw createHttpError(400, 'Invalid profile ID format');
    }

    const profile = await ProfileModel.findById(profileId);
    if (!profile) {
      console.error('❌ Profile not found:', profileId);
      throw createHttpError(404, 'Profile not found');
    }

    console.log('✅ Profile found:', profileId);

    // Validate working hours format
    const invalidHours = availability.workingHours.find(
      hour => hour.day < 0 || hour.day > 6 || !hour.start || !hour.end
    );
    if (invalidHours) {
      console.error('❌ Invalid working hours format:', invalidHours);
      throw createHttpError(400, 'Invalid working hours format');
    }
    console.log('✅ Working hours validation passed');

    console.log('📊 Current availability settings:', JSON.stringify(profile.calendar.availability, null, 2));
    console.log('📊 New availability settings:', JSON.stringify(availability, null, 2));

    profile.calendar.availability = availability;
    
    try {
      const updatedProfile = await profile.save();
      console.log('✅ Successfully updated availability');
      console.log('📅 Updated working hours:', JSON.stringify(updatedProfile.calendar.availability.workingHours, null, 2));
      return updatedProfile;
    } catch (error) {
      console.error('❌ Error updating availability:', error);
      throw error;
    }
  }

  async addEndorsement(
    profileId: string,
    skillName: string,
    endorserId: string
  ): Promise<{ success: boolean; message: string }> {
    console.log('👍 Adding endorsement:', { profileId, skillName, endorserId });
    const profile = await ProfileModel.findById(profileId);
    if (!profile) {
      console.error('❌ Profile not found:', profileId);
      throw createHttpError(404, 'Profile not found');
    }

    const skill = profile.skills.find(s => s.name === skillName);
    if (!skill) {
      console.error('❌ Skill not found:', skillName);
      throw createHttpError(404, 'Skill not found');
    }

    skill.endorsements = (skill.endorsements || 0) + 1;
    await profile.save();

    console.log('✅ Endorsement added successfully');
    return { success: true, message: 'Skill endorsed successfully' };
  }
}
