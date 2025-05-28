"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSharingMetadata = exports.trackShare = exports.generateSharingImage = exports.generateQRCode = void 0;
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const http_errors_1 = __importDefault(require("http-errors"));
const sharing_service_1 = require("../services/sharing.service");
const profile_model_1 = require("../models/profile.model");
const mongodb_1 = require("mongodb");
const sharingService = new sharing_service_1.SharingService();
// @desc    Generate QR code for profile
// @route   POST /api/sharing/:profileId/qr
// @access  Private
exports.generateQRCode = (0, express_async_handler_1.default)(async (req, res) => {
    var _a, _b;
    const user = req.user;
    const { profileId } = req.params;
    const { size, color, logo, style } = req.body;
    // Verify profile ownership or viewing permissions
    const profile = await profile_model_1.ProfileModel.findById(new mongodb_1.ObjectId(profileId));
    if (!profile) {
        throw (0, http_errors_1.default)(404, 'Profile not found');
    }
    // Check if user is the creator of the profile
    if (!((_b = (_a = profile.profileInformation) === null || _a === void 0 ? void 0 : _a.creator) === null || _b === void 0 ? void 0 : _b.equals(user._id))) {
        throw (0, http_errors_1.default)(403, 'Not authorized to generate QR code for this profile');
    }
    const qrCode = await sharingService.generateProfileQR(new mongodb_1.ObjectId(profileId), {
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
exports.generateSharingImage = (0, express_async_handler_1.default)(async (req, res) => {
    var _a, _b;
    const user = req.user;
    const { profileId } = req.params;
    const { template } = req.body;
    // Verify profile ownership or viewing permissions
    const profile = await profile_model_1.ProfileModel.findById(new mongodb_1.ObjectId(profileId));
    if (!profile) {
        throw (0, http_errors_1.default)(404, 'Profile not found');
    }
    // Check if user is the creator of the profile
    if (!((_b = (_a = profile.profileInformation) === null || _a === void 0 ? void 0 : _a.creator) === null || _b === void 0 ? void 0 : _b.equals(user._id))) {
        throw (0, http_errors_1.default)(403, 'Not authorized to generate sharing image for this profile');
    }
    const sharingImage = await sharingService.generateSharingImage(new mongodb_1.ObjectId(profileId), template);
    res.json(sharingImage);
});
// @desc    Track profile share
// @route   POST /api/sharing/:profileId/track
// @access  Public
exports.trackShare = (0, express_async_handler_1.default)(async (req, res) => {
    const { profileId } = req.params;
    const { platform } = req.body;
    const user = req.user;
    if (!['linkedin', 'twitter', 'facebook', 'email', 'whatsapp', 'qr'].includes(platform)) {
        throw (0, http_errors_1.default)(400, 'Invalid sharing platform');
    }
    await sharingService.trackShare(new mongodb_1.ObjectId(profileId), platform, user === null || user === void 0 ? void 0 : user._id);
    res.json({ success: true });
});
// @desc    Get sharing metadata for profile
// @route   GET /api/sharing/:profileId/meta
// @access  Public
exports.getSharingMetadata = (0, express_async_handler_1.default)(async (req, res) => {
    var _a, _b, _c, _d, _e;
    const { profileId } = req.params;
    const profile = await profile_model_1.ProfileModel.findById(new mongodb_1.ObjectId(profileId))
        .populate('profileInformation.creator', 'firstName lastName');
    if (!profile) {
        throw (0, http_errors_1.default)(404, 'Profile not found');
    }
    const creator = (_a = profile.profileInformation) === null || _a === void 0 ? void 0 : _a.creator; // Temporarily using 'any' to bypass TypeScript error
    const metadata = {
        title: `${(creator === null || creator === void 0 ? void 0 : creator.firstName) || 'User'} ${(creator === null || creator === void 0 ? void 0 : creator.lastName) || ''} - ${((_b = profile.profileInformation) === null || _b === void 0 ? void 0 : _b.title) || 'Profile'}`,
        description: ((_c = profile.profileInformation) === null || _c === void 0 ? void 0 : _c.title) || `Check out this professional profile`,
        image: ((_d = profile.ProfileFormat) === null || _d === void 0 ? void 0 : _d.profileImage) || '',
        url: `${process.env.FRONTEND_URL}/p/${((_e = profile.profileInformation) === null || _e === void 0 ? void 0 : _e.profileLink) || profileId}`,
        type: 'profile',
    };
    res.json(metadata);
});
