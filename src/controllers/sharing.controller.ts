import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import createHttpError from 'http-errors';
import { SharingService } from '../services/sharing.service';
import { ProfileModel } from '../models/profile.model';
import { logger } from '../utils/logger';
import { ObjectId } from 'mongodb';

const sharingService = new SharingService();

// @desc    Generate QR code for profile
// @route   POST /api/sharing/:profileId/qr
// @access  Private
export const generateQRCode = asyncHandler(async (req: Request, res: Response) => {
  const user: any = req.user!;
  const { profileId } = req.params;
  const { size, color, logo, style } = req.body;

  // Verify profile ownership or viewing permissions
  const profile = await ProfileModel.findById(new ObjectId(profileId));
  if (!profile) {
    throw createHttpError(404, 'Profile not found');
  }

  if (!profile.owner.equals(user._id) && !profile.managers.includes(user._id)) {
    throw createHttpError(403, 'Not authorized to generate QR code for this profile');
  }

  const qrCode = await sharingService.generateProfileQR(new ObjectId(profileId), {
    size,
    color,
    logo,
    style,
  });

  res.json(qrCode);
});

// @desc    Generate sharing image for profile
// @route   POST /api/sharing/:profileId/image
// @access  Private
export const generateSharingImage = asyncHandler(async (req: Request, res: Response) => {
  const user: any = req.user!;
  const { profileId } = req.params;
  const { template } = req.body;

  // Verify profile ownership or viewing permissions
  const profile = await ProfileModel.findById(new ObjectId(profileId));
  if (!profile) {
    throw createHttpError(404, 'Profile not found');
  }

  if (!profile.owner.equals(user._id) && !profile.managers.includes(user._id)) {
    throw createHttpError(403, 'Not authorized to generate sharing image for this profile');
  }

  const sharingImage = await sharingService.generateSharingImage(new ObjectId(profileId), template);

  res.json(sharingImage);
});

// @desc    Track profile share
// @route   POST /api/sharing/:profileId/track
// @access  Public
export const trackShare = asyncHandler(async (req: Request, res: Response) => {
  const { profileId } = req.params;
  const { platform } = req.body;
  const user: any = req.user;

  if (!['linkedin', 'twitter', 'facebook', 'email', 'whatsapp', 'qr'].includes(platform)) {
    throw createHttpError(400, 'Invalid sharing platform');
  }

  await sharingService.trackShare(new ObjectId(profileId), platform, user?._id);

  res.json({ success: true });
});

// @desc    Get sharing metadata for profile
// @route   GET /api/sharing/:profileId/meta
// @access  Public
export const getSharingMetadata = asyncHandler(async (req: Request, res: Response) => {
  const { profileId } = req.params;

  const profile = await ProfileModel.findById(new ObjectId(profileId))
    .populate('owner', 'firstName lastName profileImage');

  if (!profile) {
    throw createHttpError(404, 'Profile not found');
  }

  const owner = profile.owner as any; // Temporarily using 'any' to bypass TypeScript error

  const metadata = {
    title: `${owner.firstName} ${owner.lastName} - ${profile.name}`,
    description: profile.description || `Check out ${owner.firstName}'s professional profile`,
    image: owner.profileImage,
    url: `${process.env.FRONTEND_URL}/p/${profile.connectLink}`,
    type: 'profile',
  };

  res.json(metadata);
});
