"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserAnalytics = exports.getProfileAnalytics = exports.trackEngagement = exports.trackProfileView = void 0;
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const http_errors_1 = __importDefault(require("http-errors"));
const mongoose_1 = __importDefault(require("mongoose"));
const analytics_service_1 = require("../services/analytics.service");
const socketEmitter_1 = require("../utils/socketEmitter");
const analyticsService = new analytics_service_1.AnalyticsService();
// @desc    Track profile view
// @route   POST /api/analytics/profiles/:id/view
// @access  Private
exports.trackProfileView = (0, express_async_handler_1.default)(async (req, res) => {
    const user = req.user;
    const { id: profileId } = req.params;
    const { ownerId } = req.body;
    const analytics = await analyticsService.trackProfileView(new mongoose_1.default.Types.ObjectId(profileId), ownerId, user === null || user === void 0 ? void 0 : user._id, req.headers['user-agent'], req.ip);
    // Emit social interaction for profile view (only if user is authenticated and viewing someone else's profile)
    if (user && user._id && ownerId && user._id.toString() !== ownerId.toString()) {
        try {
            setImmediate(async () => {
                await (0, socketEmitter_1.emitSocialInteraction)(user._id, {
                    type: 'share', // Using 'share' as closest match for profile view
                    profile: new mongoose_1.default.Types.ObjectId(user.activeProfile || user._id),
                    targetProfile: new mongoose_1.default.Types.ObjectId(profileId),
                    contentId: new mongoose_1.default.Types.ObjectId(profileId),
                    content: 'viewed profile'
                });
            });
        }
        catch (error) {
            console.error('Failed to emit social interaction for profile view:', error);
        }
    }
    res.json(analytics);
});
// @desc    Track profile engagement
// @route   POST /api/analytics/profiles/:id/engage
// @access  Private
exports.trackEngagement = (0, express_async_handler_1.default)(async (req, res) => {
    const user = req.user;
    const { id: profileId } = req.params;
    const { ownerId, type, metadata } = req.body;
    if (!['like', 'comment', 'share', 'download', 'connect', 'message'].includes(type)) {
        throw (0, http_errors_1.default)(400, 'Invalid engagement type');
    }
    const analytics = await analyticsService.trackEngagement(new mongoose_1.default.Types.ObjectId(profileId), ownerId, user._id, type, metadata);
    // Emit social interaction for engagement tracking
    if (user._id.toString() !== ownerId.toString()) {
        try {
            setImmediate(async () => {
                await (0, socketEmitter_1.emitSocialInteraction)(user._id, {
                    type: type,
                    profile: new mongoose_1.default.Types.ObjectId(user.activeProfile || user._id),
                    targetProfile: new mongoose_1.default.Types.ObjectId(profileId),
                    contentId: new mongoose_1.default.Types.ObjectId(profileId),
                    content: `${type} engagement${metadata ? `: ${JSON.stringify(metadata)}` : ''}`
                });
            });
        }
        catch (error) {
            console.error('Failed to emit social interaction for engagement:', error);
        }
    }
    res.json(analytics);
});
// @desc    Get profile analytics
// @route   GET /api/analytics/profiles/:id
// @access  Private
exports.getProfileAnalytics = (0, express_async_handler_1.default)(async (req, res) => {
    const { id: profileId } = req.params;
    const { period } = req.query;
    // Validate period
    if (period && !['day', 'week', 'month', 'year'].includes(period)) {
        throw (0, http_errors_1.default)(400, 'Invalid period specified');
    }
    const analytics = await analyticsService.getProfileAnalytics(new mongoose_1.default.Types.ObjectId(profileId), period);
    if (!analytics) {
        throw (0, http_errors_1.default)(404, 'Analytics not found for this profile');
    }
    res.json(analytics);
});
// @desc    Get user's profiles analytics
// @route   GET /api/analytics/user
// @access  Private
exports.getUserAnalytics = (0, express_async_handler_1.default)(async (req, res) => {
    const user = req.user;
    const analytics = await analyticsService.getUserAnalytics(user._id);
    res.json(analytics);
});
