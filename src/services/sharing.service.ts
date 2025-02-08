import QRCode from 'qrcode';
import { ProfileModel } from '../models/profile.model';
import { AnalyticsService } from './analytics.service';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';
import { createCanvas, loadImage } from 'canvas';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';

export class SharingService {
  private analyticsService: AnalyticsService;
  private qrStoragePath: string;

  constructor() {
    this.analyticsService = new AnalyticsService();
    this.qrStoragePath = path.join(process.cwd(), 'uploads', 'qr-codes');
    this.ensureQRDirectory();
  }

  private async ensureQRDirectory() {
    try {
      await fs.mkdir(this.qrStoragePath, { recursive: true });
    } catch (error) {
      logger.error('Error creating QR code directory:', error);
    }
  }

  async generateProfileQR(
    profileId: mongoose.Types.ObjectId,
    options: {
      size?: number;
      color?: string;
      logo?: string;
      style?: 'standard' | 'dot' | 'square';
    } = {}
  ) {
    try {
      const profile = await ProfileModel.findById(profileId);
      if (!profile) {
        throw new Error('Profile not found');
      }

      const {
        size = 300,
        color = '#000000',
        style = 'standard'
      } = options;

      // Generate profile URL
      const profileUrl = `${process.env.FRONTEND_URL}/p/${profile.connectLink}`;

      // QR Code options
      const qrOptions: QRCode.QRCodeToBufferOptions = {
        errorCorrectionLevel: 'H',
        type: 'png',
        margin: 1,
        color: {
          dark: color,
          light: '#ffffff00',
        },
        width: size,
      };

      // Generate QR code
      const qrCodeBuffer = await QRCode.toBuffer(profileUrl, qrOptions);

      // Add logo if provided
      let finalQRCode = qrCodeBuffer;
      if (options.logo) {
        finalQRCode = await this.addLogoToQR(qrCodeBuffer, options.logo, size);
      }

      // Apply style
      if (style !== 'standard') {
        finalQRCode = await this.applyQRStyle(finalQRCode, style);
      }

      // Save QR code
      const fileName = `qr-${profileId}-${Date.now()}.png`;
      const filePath = path.join(this.qrStoragePath, fileName);
      await fs.writeFile(filePath, finalQRCode);

      return {
        url: `/uploads/qr-codes/${fileName}`,
        profileUrl,
      };
    } catch (error) {
      logger.error('Error generating QR code:', error);
      throw error;
    }
  }

  private async addLogoToQR(qrBuffer: Buffer, logoPath: string, size: number) {
    try {
      const canvas = createCanvas(size, size);
      const ctx = canvas.getContext('2d');

      // Draw QR code
      const qrImage = await loadImage(qrBuffer);
      ctx.drawImage(qrImage, 0, 0, size, size);

      // Load and draw logo
      const logo = await loadImage(logoPath);
      const logoSize = size * 0.2; // Logo takes up 20% of QR code
      const logoX = (size - logoSize) / 2;
      const logoY = (size - logoSize) / 2;
      ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);

      return canvas.toBuffer('image/png');
    } catch (error) {
      logger.error('Error adding logo to QR:', error);
      throw error;
    }
  }

  private async loadImage(source: string | Buffer) {
    return await loadImage(source);
  }

  private async applyQRStyle(qrBuffer: Buffer, style: 'dot' | 'square') {
    try {
      const image = sharp(qrBuffer);

      if (style === 'dot') {
        // Apply circular mask to each QR code module
        return image
          .composite([{
            input: Buffer.from(`
              <svg>
                <defs>
                  <filter id="circular">
                    <feGaussianBlur stdDeviation="2" />
                    <feColorMatrix type="matrix"
                      values="1 0 0 0 0
                              0 1 0 0 0
                              0 0 1 0 0
                              0 0 0 9 -4"/>
                    <feComposite operator="atop" in="SourceGraphic"/>
                  </filter>
                </defs>
                <rect width="100%" height="100%" filter="url(#circular)"/>
              </svg>`
            ),
            blend: 'dest-in'
          }])
          .toBuffer();
      }

      // For square style, just return the original
      return qrBuffer;
    } catch (error) {
      logger.error('Error applying QR style:', error);
      throw error;
    }
  }

  async generateSharingImage(
    profileId: mongoose.Types.ObjectId,
    template: 'standard' | 'professional' | 'creative' = 'standard'
  ) {
    try {
      const profile = await ProfileModel.findById(profileId).populate('owner', 'firstName lastName profileImage');
      if (!profile) {
        throw new Error('Profile not found');
      }

      const canvas = createCanvas(1200, 630); // Standard social sharing size
      const ctx = canvas.getContext('2d');

      // Apply template-specific styling
      await this.applyTemplate(ctx, template, profile);

      const fileName = `share-${profileId}-${Date.now()}.png`;
      const filePath = path.join(this.qrStoragePath, fileName);
      
      const buffer = canvas.toBuffer('image/png');
      await fs.writeFile(filePath, buffer);

      return {
        url: `/uploads/qr-codes/${fileName}`,
        socialMeta: this.generateSocialMeta(profile),
      };
    } catch (error) {
      logger.error('Error generating sharing image:', error);
      throw error;
    }
  }

  private async applyTemplate(
    ctx: any,
    template: string,
    profile: any
  ) {
    // Base styling
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 1200, 630);

    switch (template) {
      case 'professional':
        await this.applyProfessionalTemplate(ctx, profile);
        break;
      case 'creative':
        await this.applyCreativeTemplate(ctx, profile);
        break;
      default:
        await this.applyStandardTemplate(ctx, profile);
    }
  }

  private async applyStandardTemplate(ctx: any, profile: any) {
    // Background
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, 1200, 630);

    // Profile info
    ctx.font = 'bold 48px Arial';
    ctx.fillStyle = '#000000';
    ctx.fillText(`${profile.owner.firstName} ${profile.owner.lastName}`, 60, 100);

    ctx.font = '32px Arial';
    ctx.fillStyle = '#666666';
    ctx.fillText(profile.name, 60, 160);

    // Add profile image if available
    if (profile.owner.profileImage) {
      const img = await loadImage(profile.owner.profileImage);
      ctx.drawImage(img, 800, 100, 300, 300);
    }
  }

  private async applyProfessionalTemplate(ctx: any, profile: any) {
    // Gradient background
    const gradient = ctx.createLinearGradient(0, 0, 1200, 630);
    gradient.addColorStop(0, '#2c3e50');
    gradient.addColorStop(1, '#3498db');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1200, 630);

    // White text
    ctx.font = 'bold 56px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${profile.owner.firstName} ${profile.owner.lastName}`, 60, 120);

    ctx.font = '36px Arial';
    ctx.fillText(profile.name, 60, 180);
  }

  private async applyCreativeTemplate(ctx: any, profile: any) {
    // Playful background
    ctx.fillStyle = '#ff6b6b';
    ctx.fillRect(0, 0, 1200, 630);

    // Add decorative elements
    ctx.beginPath();
    ctx.fillStyle = '#4ecdc4';
    ctx.arc(1000, 100, 80, 0, Math.PI * 2);
    ctx.fill();

    // White text with shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 5;
    ctx.shadowOffsetY = 5;

    ctx.font = 'bold 64px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${profile.owner.firstName}`, 60, 120);
    ctx.fillText(`${profile.owner.lastName}`, 60, 200);
  }

  private generateSocialMeta(profile: any) {
    return {
      title: `${profile.owner.firstName} ${profile.owner.lastName} - ${profile.name}`,
      description: profile.description || `Check out ${profile.owner.firstName}'s professional profile`,
      image: profile.owner.profileImage,
      url: `${process.env.FRONTEND_URL}/p/${profile.connectLink}`,
    };
  }

  async trackShare(
    profileId: mongoose.Types.ObjectId,
    platform: 'linkedin' | 'twitter' | 'facebook' | 'email' | 'whatsapp' | 'qr',
    userId?: mongoose.Types.ObjectId
  ) {
    try {
      const profile = await ProfileModel.findById(profileId);
      if (!profile) {
        throw new Error('Profile not found');
      }

      // Track share as an engagement
      await this.analyticsService.trackEngagement(
        profileId,
        profile.owner,
        userId || profile.owner,
        'share',
        { platform }
      );

      return true;
    } catch (error) {
      logger.error('Error tracking share:', error);
      throw error;
    }
  }
}
