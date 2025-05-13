import { Request, Response } from 'express';
import { OrganizationService } from '../services/organization.service';
import asyncHandler from 'express-async-handler';
import createHttpError from 'http-errors';
import { Types } from 'mongoose';
import CloudinaryService from '../services/cloudinary.service';

// Helper function to validate organization data
const validateOrganizationData = (data: any) => {
    const errors: string[] = [];

    if (!data.name) errors.push('name is required');
    if (!data.type) errors.push('type is required');
    if (!data.profileId) errors.push('profileId is required');

    // Validate enums
    if (data.type && !['company', 'non-profit', 'government', 'educational', 'other'].includes(data.type)) {
        errors.push(`type must be one of: company, non-profit, government, educational, other`);
    }
    if (data.size && !['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'].includes(data.size)) {
        errors.push(`size must be one of: 1-10, 11-50, 51-200, 201-500, 501-1000, 1000+`);
    }
    if (data.status && !['active', 'inactive', 'pending'].includes(data.status)) {
        errors.push(`status must be one of: active, inactive, pending`);
    }
    if (data.settings?.visibility && !['public', 'private', 'members-only'].includes(data.settings.visibility)) {
        errors.push(`visibility must be one of: public, private, members-only`);
    }

    if (errors.length > 0) {
        throw createHttpError(400, errors.join('; '));
    }
};

export class OrganizationController {
    private organizationService: OrganizationService;
    private cloudinaryService: CloudinaryService;

    constructor() {
        this.organizationService = new OrganizationService();
        this.cloudinaryService = new CloudinaryService();
    }

    // @desc    Create a new organization
    // @route   POST /organizations
    // @access  Private
    createOrganization = asyncHandler(async (req: Request, res: Response) => {
        validateOrganizationData(req.body);

        const organization = await this.organizationService.createOrganization(
            req.body,
            new Types.ObjectId(req.body.profileId)
        );

        res.status(201).json({
            success: true,
            data: organization,
            message: 'Organization created successfully'
        });
    });

    // @desc    Get organization by ID
    // @route   GET /organizations/:id
    // @access  Private
    getOrganization = asyncHandler(async (req: Request, res: Response) => {
        if (!req.params.id || !Types.ObjectId.isValid(req.params.id)) {
            throw createHttpError(400, 'Invalid organization ID');
        }

        const organization = await this.organizationService.getOrganization(req.params.id);

        res.status(200).json({
            success: true,
            data: organization,
            message: 'Organization fetched successfully'
        });
    });

    // @desc    Update organization
    // @route   PATCH /organizations/:id
    // @access  Private
    updateOrganization = asyncHandler(async (req: Request, res: Response) => {
        if (!req.params.id || !Types.ObjectId.isValid(req.params.id)) {
            throw createHttpError(400, 'Invalid organization ID');
        }

        if (!req.body.profileId || !Types.ObjectId.isValid(req.body.profileId)) {
            throw createHttpError(400, 'Invalid profile ID');
        }

        validateOrganizationData(req.body);

        const organization = await this.organizationService.updateOrganization(
            req.params.id,
            req.body,
            new Types.ObjectId(req.body.profileId)
        );

        res.status(200).json({
            success: true,
            data: organization,
            message: 'Organization updated successfully'
        });
    });

    // @desc    Delete organization
    // @route   DELETE /organizations/:id
    // @access  Private
    deleteOrganization = asyncHandler(async (req: Request, res: Response) => {
        if (!req.params.id || !Types.ObjectId.isValid(req.params.id)) {
            throw createHttpError(400, 'Invalid organization ID');
        }

        if (!req.body.profileId || !Types.ObjectId.isValid(req.body.profileId)) {
            throw createHttpError(400, 'Invalid profile ID');
        }

        await this.organizationService.deleteOrganization(
            req.params.id,
            new Types.ObjectId(req.body.profileId)
        );

        res.status(200).json({
            success: true,
            data: null,
            message: 'Organization deleted successfully'
        });
    });

    // @desc    Upload organization logo
    // @route   POST /organizations/:id/logo
    // @access  Private
    uploadLogo = asyncHandler(async (req: Request, res: Response) => {
        if (!req.params.id || !Types.ObjectId.isValid(req.params.id)) {
            throw createHttpError(400, 'Invalid organization ID');
        }

        if (!req.body.profileId || !Types.ObjectId.isValid(req.body.profileId)) {
            throw createHttpError(400, 'Invalid profile ID');
        }

        if (!req.body.data || typeof req.body.data !== 'string' || !req.body.data.startsWith('data:')) {
            throw createHttpError(400, 'Invalid base64 data format');
        }

        const uploadResult = await this.cloudinaryService.uploadAndReturnAllInfo(
            req.body.data,
            {
                folder: `organizations/${req.params.id}/logo`,
                transformation: {
                    width: 200,
                    height: 200,
                    crop: 'fill'
                }
            }
        );

        const organization = await this.organizationService.updateOrganization(
            req.params.id,
            {
                logo: {
                    url: uploadResult.secure_url,
                    publicId: uploadResult.public_id
                }
            },
            new Types.ObjectId(req.body.profileId)
        );

        res.status(200).json({
            success: true,
            data: organization,
            message: 'Logo uploaded successfully'
        });
    });

    // @desc    Upload organization cover image
    // @route   POST /organizations/:id/cover
    // @access  Private
    uploadCoverImage = asyncHandler(async (req: Request, res: Response) => {
        if (!req.params.id || !Types.ObjectId.isValid(req.params.id)) {
            throw createHttpError(400, 'Invalid organization ID');
        }

        if (!req.body.profileId || !Types.ObjectId.isValid(req.body.profileId)) {
            throw createHttpError(400, 'Invalid profile ID');
        }

        if (!req.body.data || typeof req.body.data !== 'string' || !req.body.data.startsWith('data:')) {
            throw createHttpError(400, 'Invalid base64 data format');
        }

        const uploadResult = await this.cloudinaryService.uploadAndReturnAllInfo(
            req.body.data,
            {
                folder: `organizations/${req.params.id}/cover`,
                transformation: {
                    width: 1200,
                    height: 400,
                    crop: 'fill'
                }
            }
        );

        const organization = await this.organizationService.updateOrganization(
            req.params.id,
            {
                coverImage: {
                    url: uploadResult.secure_url,
                    publicId: uploadResult.public_id
                }
            },
            new Types.ObjectId(req.body.profileId)
        );

        res.status(200).json({
            success: true,
            data: organization,
            message: 'Cover image uploaded successfully'
        });
    });

    // @desc    Add member to organization
    // @route   POST /organizations/:id/members
    // @access  Private
    addMember = asyncHandler(async (req: Request, res: Response) => {
        if (!req.params.id || !Types.ObjectId.isValid(req.params.id)) {
            throw createHttpError(400, 'Invalid organization ID');
        }

        if (!req.body.profileId || !Types.ObjectId.isValid(req.body.profileId)) {
            throw createHttpError(400, 'Invalid profile ID');
        }

        if (!req.body.memberProfileId || !Types.ObjectId.isValid(req.body.memberProfileId)) {
            throw createHttpError(400, 'Invalid member profile ID');
        }

        const organization = await this.organizationService.addMember(
            req.params.id,
            new Types.ObjectId(req.body.memberProfileId),
            req.body.role,
            new Types.ObjectId(req.body.profileId)
        );

        res.status(200).json({
            success: true,
            data: organization,
            message: 'Member added successfully'
        });
    });

    // @desc    Remove member from organization
    // @route   DELETE /organizations/:id/members
    // @access  Private
    removeMember = asyncHandler(async (req: Request, res: Response) => {
        if (!req.params.id || !Types.ObjectId.isValid(req.params.id)) {
            throw createHttpError(400, 'Invalid organization ID');
        }

        if (!req.body.profileId || !Types.ObjectId.isValid(req.body.profileId)) {
            throw createHttpError(400, 'Invalid profile ID');
        }

        if (!req.body.memberProfileId || !Types.ObjectId.isValid(req.body.memberProfileId)) {
            throw createHttpError(400, 'Invalid member profile ID');
        }

        const organization = await this.organizationService.removeMember(
            req.params.id,
            new Types.ObjectId(req.body.memberProfileId),
            new Types.ObjectId(req.body.profileId)
        );

        res.status(200).json({
            success: true,
            data: organization,
            message: 'Member removed successfully'
        });
    });

    // @desc    Update member role
    // @route   PATCH /organizations/:id/members/role
    // @access  Private
    updateMemberRole = asyncHandler(async (req: Request, res: Response) => {
        if (!req.params.id || !Types.ObjectId.isValid(req.params.id)) {
            throw createHttpError(400, 'Invalid organization ID');
        }

        if (!req.body.profileId || !Types.ObjectId.isValid(req.body.profileId)) {
            throw createHttpError(400, 'Invalid profile ID');
        }

        if (!req.body.memberProfileId || !Types.ObjectId.isValid(req.body.memberProfileId)) {
            throw createHttpError(400, 'Invalid member profile ID');
        }

        if (!req.body.newRole || !['owner', 'admin', 'member'].includes(req.body.newRole)) {
            throw createHttpError(400, 'Invalid role');
        }

        const organization = await this.organizationService.updateMemberRole(
            req.params.id,
            new Types.ObjectId(req.body.memberProfileId),
            req.body.newRole,
            new Types.ObjectId(req.body.profileId)
        );

        res.status(200).json({
            success: true,
            data: organization,
            message: 'Member role updated successfully'
        });
    });

    // @desc    List organizations
    // @route   GET /organizations
    // @access  Private
    listOrganizations = asyncHandler(async (req: Request, res: Response) => {
        if (!req.query.profileId || !Types.ObjectId.isValid(req.query.profileId as string)) {
            throw createHttpError(400, 'Invalid profile ID');
        }

        const filters = {
            ...req.query,
            memberProfileId: new Types.ObjectId(req.query.profileId as string)
        };

        const result = await this.organizationService.listOrganizations(filters);

        res.status(200).json({
            success: true,
            data: result.organizations,
            pagination: {
                total: result.total,
                page: result.page,
                totalPages: result.totalPages
            },
            message: 'Organizations fetched successfully'
        });
    });
} 