import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { ScanModel, IScan, ScanType } from '../models/scan.model';
import CloudinaryService from '../services/cloudinary.service';

// Helper function to validate scan data
const validateScanData = (data: any) => {
  const errors: string[] = [];

  if (!data.profileId) errors.push('profileId is required');
  if (!data.type) errors.push('type is required');

  const validTypes: ScanType[] = ['badge', 'doc', 'qrcode', 'card'];
  if (!validTypes.includes(data.type)) {
    errors.push(`type must be one of: ${validTypes.join(', ')}`);
  }

  // Validate based on scan type
  if (data.type === 'qrcode') {
    if (!data.text) {
      errors.push('text is required for QR code scans');
    }
  } else {
    // File-based scans need base64 data
    if (!data.fileData) {
      errors.push(`fileData is required for ${data.type} scans`);
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join('; '));
  }
};

export const createScan = async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;

    // Validate profileId
    if (!mongoose.Types.ObjectId.isValid(profileId)) {
      return res.status(400).json({ error: 'Invalid profile ID' });
    }

    validateScanData(req.body);

    const scanData: Partial<IScan> = {
      profileId: new mongoose.Types.ObjectId(profileId),
      type: req.body.type,
      data: {}
    };

    // Handle different scan types
    if (req.body.type === 'qrcode') {
      // QR code scans store text data directly
      scanData.data = {
        text: req.body.text,
        metadata: req.body.metadata || {}
      };
    } else {
      // File-based scans (badge, doc, card)
      const fileName = req.body.fileName || `scan_${Date.now()}`;
      const fileType = req.body.fileType || 'application/octet-stream';
      const fileSize = req.body.fileSize || 0;

      // Upload base64 to Cloudinary
      const cloudinaryService = new CloudinaryService();
      const fileUrl = await cloudinaryService.upload(req.body.fileData, {
        folder: `scans/${req.body.type}`,
        resourceType: 'auto'
      });

      scanData.data = {
        fileUrl,
        fileName,
        fileType,
        fileSize,
        metadata: req.body.metadata || {}
      };
    }

    const scan = await ScanModel.create(scanData);
    res.status(201).json(scan);

  } catch (error) {
    console.error('Error creating scan:', error);
    res.status(400).json({
      error: error instanceof Error ? error.message : 'An unknown error occurred',
      details: error instanceof Error ? error.stack : undefined,
    });
  }
};

export const getProfileScans = async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const { type, limit = 50, skip = 0, sort = '-createdAt' } = req.query;

    // Validate profileId
    if (!mongoose.Types.ObjectId.isValid(profileId)) {
      return res.status(400).json({ error: 'Invalid profile ID' });
    }

    // Build query
    const query: any = { profileId: new mongoose.Types.ObjectId(profileId) };

    if (type) {
      const validTypes: ScanType[] = ['badge', 'doc', 'qrcode', 'card'];
      if (!validTypes.includes(type as ScanType)) {
        return res.status(400).json({
          error: `Invalid type. Must be one of: ${validTypes.join(', ')}`
        });
      }
      query.type = type;
    }

    const scans = await ScanModel
      .find(query)
      .sort(sort as string)
      .limit(Number(limit))
      .skip(Number(skip))
      .lean();

    // Get total count for pagination
    const total = await ScanModel.countDocuments(query);

    res.json({
      scans,
      pagination: {
        total,
        limit: Number(limit),
        skip: Number(skip),
        hasMore: Number(skip) + scans.length < total
      }
    });

  } catch (error) {
    console.error('Error fetching scans:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
};

export const getScanById = async (req: Request, res: Response) => {
  try {
    const { scanId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(scanId)) {
      return res.status(400).json({ error: 'Invalid scan ID' });
    }

    const scan = await ScanModel.findById(scanId).lean();

    if (!scan) {
      return res.status(404).json({ error: 'Scan not found' });
    }

    res.json(scan);

  } catch (error) {
    console.error('Error fetching scan:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
};

export const updateScan = async (req: Request, res: Response) => {
  try {
    const { scanId } = req.params;
    const { metadata } = req.body;

    if (!mongoose.Types.ObjectId.isValid(scanId)) {
      return res.status(400).json({ error: 'Invalid scan ID' });
    }

    // Only allow updating metadata for now
    const updateData: any = {};
    if (metadata) {
      updateData['data.metadata'] = metadata;
    }

    const scan = await ScanModel.findByIdAndUpdate(
      scanId,
      updateData,
      { new: true, runValidators: true }
    ).lean();

    if (!scan) {
      return res.status(404).json({ error: 'Scan not found' });
    }

    res.json(scan);

  } catch (error) {
    console.error('Error updating scan:', error);
    res.status(400).json({
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
};

export const deleteScan = async (req: Request, res: Response) => {
  try {
    const { scanId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(scanId)) {
      return res.status(400).json({ error: 'Invalid scan ID' });
    }

    const scan = await ScanModel.findById(scanId);

    if (!scan) {
      return res.status(404).json({ error: 'Scan not found' });
    }

    // Delete file from Cloudinary if it exists
    if (scan.data.fileUrl) {
      try {
        const cloudinaryService = new CloudinaryService();
        // Extract public_id from Cloudinary URL
        const urlParts = scan.data.fileUrl.split('/');
        const fileWithExtension = urlParts[urlParts.length - 1];
        const publicId = fileWithExtension.split('.')[0];
        const folder = `scans/${scan.type}`;
        const fullPublicId = `${folder}/${publicId}`;

        await cloudinaryService.delete(fullPublicId);
      } catch (cloudinaryError) {
        console.error('Error deleting file from Cloudinary:', cloudinaryError);
        // Continue with database deletion even if Cloudinary deletion fails
      }
    }

    await ScanModel.findByIdAndDelete(scanId);

    res.json({ message: 'Scan deleted successfully' });

  } catch (error) {
    console.error('Error deleting scan:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
};

export const getScanStats = async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(profileId)) {
      return res.status(400).json({ error: 'Invalid profile ID' });
    }

    const stats = await ScanModel.aggregate([
      {
        $match: { profileId: new mongoose.Types.ObjectId(profileId) }
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          latestScan: { $max: '$createdAt' }
        }
      },
      {
        $project: {
          type: '$_id',
          count: 1,
          latestScan: 1,
          _id: 0
        }
      }
    ]);

    const totalScans = await ScanModel.countDocuments({
      profileId: new mongoose.Types.ObjectId(profileId)
    });

    res.json({
      totalScans,
      byType: stats
    });

  } catch (error) {
    console.error('Error fetching scan stats:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
};
