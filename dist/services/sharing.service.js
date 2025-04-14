"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SharingService = void 0;
const qrcode_1 = __importDefault(require("qrcode"));
const profile_model_1 = require("../models/profile.model");
const analytics_service_1 = require("./analytics.service");
const logger_1 = require("../utils/logger");
const canvas_1 = require("canvas");
const sharp_1 = __importDefault(require("sharp"));
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
class SharingService {
    constructor() {
        this.analyticsService = new analytics_service_1.AnalyticsService();
        this.qrStoragePath = path_1.default.join(process.cwd(), 'uploads', 'qr-codes');
        this.ensureQRDirectory();
    }
    async ensureQRDirectory() {
        try {
            await promises_1.default.mkdir(this.qrStoragePath, { recursive: true });
        }
        catch (error) {
            logger_1.logger.error('Error creating QR code directory:', error);
        }
    }
    async generateProfileQR(profileId, options = {}) {
        try {
            const profile = await profile_model_1.ProfileModel.findById(profileId);
            if (!profile) {
                throw new Error('Profile not found');
            }
            const { size = 300, color = '#000000', style = 'standard' } = options;
            // Generate profile URL
            const profileUrl = `${process.env.FRONTEND_URL}/p/${profile.connectLink}`;
            // QR Code options
            const qrOptions = {
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
            const qrCodeBuffer = await qrcode_1.default.toBuffer(profileUrl, qrOptions);
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
            const filePath = path_1.default.join(this.qrStoragePath, fileName);
            await promises_1.default.writeFile(filePath, finalQRCode);
            return {
                url: `/uploads/qr-codes/${fileName}`,
                profileUrl,
            };
        }
        catch (error) {
            logger_1.logger.error('Error generating QR code:', error);
            throw error;
        }
    }
    async addLogoToQR(qrBuffer, logoPath, size) {
        try {
            const canvas = (0, canvas_1.createCanvas)(size, size);
            const ctx = canvas.getContext('2d');
            // Draw QR code
            const qrImage = await (0, canvas_1.loadImage)(qrBuffer);
            ctx.drawImage(qrImage, 0, 0, size, size);
            // Load and draw logo
            const logo = await (0, canvas_1.loadImage)(logoPath);
            const logoSize = size * 0.2; // Logo takes up 20% of QR code
            const logoX = (size - logoSize) / 2;
            const logoY = (size - logoSize) / 2;
            ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);
            return canvas.toBuffer('image/png');
        }
        catch (error) {
            logger_1.logger.error('Error adding logo to QR:', error);
            throw error;
        }
    }
    async loadImage(source) {
        return await (0, canvas_1.loadImage)(source);
    }
    async applyQRStyle(qrBuffer, style) {
        try {
            const image = (0, sharp_1.default)(qrBuffer);
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
              </svg>`),
                        blend: 'dest-in'
                    }])
                    .toBuffer();
            }
            // For square style, just return the original
            return qrBuffer;
        }
        catch (error) {
            logger_1.logger.error('Error applying QR style:', error);
            throw error;
        }
    }
    async generateSharingImage(profileId, template = 'standard') {
        try {
            const profile = await profile_model_1.ProfileModel.findById(profileId).populate('owner', 'firstName lastName profileImage');
            if (!profile) {
                throw new Error('Profile not found');
            }
            const canvas = (0, canvas_1.createCanvas)(1200, 630); // Standard social sharing size
            const ctx = canvas.getContext('2d');
            // Apply template-specific styling
            await this.applyTemplate(ctx, template, profile);
            const fileName = `share-${profileId}-${Date.now()}.png`;
            const filePath = path_1.default.join(this.qrStoragePath, fileName);
            const buffer = canvas.toBuffer('image/png');
            await promises_1.default.writeFile(filePath, buffer);
            return {
                url: `/uploads/qr-codes/${fileName}`,
                socialMeta: this.generateSocialMeta(profile),
            };
        }
        catch (error) {
            logger_1.logger.error('Error generating sharing image:', error);
            throw error;
        }
    }
    async applyTemplate(ctx, template, profile) {
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
    async applyStandardTemplate(ctx, profile) {
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
            const img = await (0, canvas_1.loadImage)(profile.owner.profileImage);
            ctx.drawImage(img, 800, 100, 300, 300);
        }
    }
    async applyProfessionalTemplate(ctx, profile) {
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
    async applyCreativeTemplate(ctx, profile) {
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
    generateSocialMeta(profile) {
        return {
            title: `${profile.owner.firstName} ${profile.owner.lastName} - ${profile.name}`,
            description: profile.description || `Check out ${profile.owner.firstName}'s professional profile`,
            image: profile.owner.profileImage,
            url: `${process.env.FRONTEND_URL}/p/${profile.connectLink}`,
        };
    }
    async trackShare(profileId, platform, userId) {
        try {
            const profile = await profile_model_1.ProfileModel.findById(profileId);
            if (!profile) {
                throw new Error('Profile not found');
            }
            // Track share as an engagement
            await this.analyticsService.trackEngagement(profileId, profile.owner, userId || profile.owner, 'share', { platform });
            return true;
        }
        catch (error) {
            logger_1.logger.error('Error tracking share:', error);
            throw error;
        }
    }
}
exports.SharingService = SharingService;
