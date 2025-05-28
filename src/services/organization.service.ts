import { Types } from 'mongoose';
import { Organization, IOrganization } from '../models/Organization';
import createHttpError from 'http-errors';
import CloudinaryService from './cloudinary.service';

export class OrganizationService {
  private cloudinaryService: CloudinaryService;

  constructor() {
    this.cloudinaryService = new CloudinaryService();
  }

  // Create a new organization
  async createOrganization(
    data: {
      name: string;
      description?: string;
      type: 'company' | 'non-profit' | 'government' | 'educational' | 'other';
      industry?: string;
      website?: string;
      email?: string;
      phone?: string;
      address?: {
        street: string;
        city: string;
        state: string;
        country: string;
        zipCode: string;
      };
      socialMedia?: {
        linkedin?: string;
        twitter?: string;
        facebook?: string;
        instagram?: string;
      };
      foundedDate?: Date;
      size?: '1-10' | '11-50' | '51-200' | '201-500' | '501-1000' | '1000+';
    },
    creatorProfileId: Types.ObjectId
  ): Promise<IOrganization> {
    const organization = new Organization({
      ...data,
      createdBy: creatorProfileId,
      updatedBy: creatorProfileId,
      members: [{
        profileId: creatorProfileId,
        role: 'owner',
        joinedAt: new Date(),
        status: 'active'
      }]
    });

    await organization.save();
    return organization;
  }

  // Get organization by ID
  async getOrganization(organizationId: string): Promise<IOrganization> {
    const organization = await Organization.findById(organizationId)
      .populate('members.profileId', 'name avatar')
      .populate('createdBy', 'name avatar')
      .populate('updatedBy', 'name avatar');

    if (!organization) {
      throw createHttpError(404, 'Organization not found');
    }

    return organization;
  }

  // Update organization
  async updateOrganization(
    organizationId: string,
    data: Partial<IOrganization>,
    updaterProfileId: Types.ObjectId
  ): Promise<IOrganization> {
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      throw createHttpError(404, 'Organization not found');
    }

    if (!organization.isAdmin(updaterProfileId)) {
      throw createHttpError(403, 'Only admins can update organization details');
    }

    Object.assign(organization, {
      ...data,
      updatedBy: updaterProfileId
    });

    await organization.save();
    return organization;
  }

  // Delete organization
  async deleteOrganization(
    organizationId: string,
    deleterProfileId: Types.ObjectId
  ): Promise<void> {
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      throw createHttpError(404, 'Organization not found');
    }

    if (!organization.isOwner(deleterProfileId)) {
      throw createHttpError(403, 'Only owners can delete the organization');
    }

    await organization.deleteOne();
  }

  // Upload organization logo
  async uploadLogo(organizationId: string, base64Data: string, profileId: Types.ObjectId): Promise<IOrganization> {
    const organization = await this.getOrganization(organizationId);

    // Check if user is admin or owner
    if (!organization.isAdmin(profileId)) {
      throw createHttpError(403, 'Only admins and owners can upload organization logo');
    }

    // Delete old logo if exists
    if (organization.logo?.publicId) {
      await this.cloudinaryService.delete(organization.logo.publicId);
    }

    const uploadResult = await this.cloudinaryService.uploadAndReturnAllInfo(base64Data, {
      folder: `organizations/${organizationId}/logo`,
      transformation: {
        width: 200,
        height: 200,
        crop: 'fill'
      }
    });

    // Update organization with new logo
    organization.logo = {
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id
    };

    await organization.save();
    return organization;
  }

  // Upload organization cover image
  async uploadCoverImage(organizationId: string, base64Data: string, profileId: Types.ObjectId): Promise<IOrganization> {
    const organization = await this.getOrganization(organizationId);

    // Check if user is admin or owner
    if (!organization.isAdmin(profileId)) {
      throw createHttpError(403, 'Only admins and owners can upload organization cover image');
    }

    // Delete old cover image if exists
    if (organization.coverImage?.publicId) {
      await this.cloudinaryService.delete(organization.coverImage.publicId);
    }

    const uploadResult = await this.cloudinaryService.uploadAndReturnAllInfo(base64Data, {
      folder: `organizations/${organizationId}/cover`,
      transformation: {
        width: 1200,
        height: 400,
        crop: 'fill'
      }
    });

    // Update organization with new cover image
    organization.coverImage = {
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id
    };

    await organization.save();
    return organization;
  }

  // Add member to organization
  async addMember(
    organizationId: string,
    profileId: Types.ObjectId,
    role: 'owner' | 'admin' | 'member' = 'member',
    adderProfileId: Types.ObjectId
  ): Promise<IOrganization> {
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      throw createHttpError(404, 'Organization not found');
    }

    if (!organization.isAdmin(adderProfileId)) {
      throw createHttpError(403, 'Only admins can add members');
    }

    await organization.addMember(profileId, role);
    return organization;
  }

  // Remove member from organization
  async removeMember(
    organizationId: string,
    profileId: Types.ObjectId,
    removerProfileId: Types.ObjectId
  ): Promise<IOrganization> {
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      throw createHttpError(404, 'Organization not found');
    }

    if (!organization.isAdmin(removerProfileId)) {
      throw createHttpError(403, 'Only admins can remove members');
    }

    if (organization.isOwner(profileId)) {
      throw createHttpError(400, 'Cannot remove the owner');
    }

    await organization.removeMember(profileId);
    return organization;
  }

  // Update member role
  async updateMemberRole(
    organizationId: string,
    profileId: Types.ObjectId,
    newRole: 'owner' | 'admin' | 'member',
    updaterProfileId: Types.ObjectId
  ): Promise<IOrganization> {
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      throw createHttpError(404, 'Organization not found');
    }

    if (!organization.isOwner(updaterProfileId)) {
      throw createHttpError(403, 'Only owners can update member roles');
    }

    await organization.updateMemberRole(profileId, newRole);
    return organization;
  }

  // List organizations with filters
  async listOrganizations(filters: {
    search?: string;
    type?: string;
    industry?: string;
    status?: string;
    memberProfileId?: Types.ObjectId;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{
    organizations: IOrganization[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const query: any = {};

    if (filters.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: 'i' } },
        { description: { $regex: filters.search, $options: 'i' } }
      ];
    }

    if (filters.type) query.type = filters.type;
    if (filters.industry) query.industry = filters.industry;
    if (filters.status) query.status = filters.status;

    if (filters.memberProfileId) {
      query['members.profileId'] = filters.memberProfileId;
    }

    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const skip = (page - 1) * limit;

    const sort: any = {};
    if (filters.sortBy) {
      sort[filters.sortBy] = filters.sortOrder === 'desc' ? -1 : 1;
    } else {
      sort.createdAt = -1;
    }

    const [organizations, total] = await Promise.all([
      Organization.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('members.profileId', 'name avatar')
        .populate('createdBy', 'name avatar'),
      Organization.countDocuments(query)
    ]);

    return {
      organizations,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }
} 