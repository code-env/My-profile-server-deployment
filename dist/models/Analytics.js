"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Analytics = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const analyticsSchema = new mongoose_1.Schema({
    profileId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Profile',
        required: true,
        index: true,
    },
    ownerId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    views: [{
            timestamp: { type: Date, required: true },
            viewer: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
            location: {
                country: String,
                city: String,
            },
            device: {
                type: String,
                browser: String,
                os: String,
            },
            duration: Number,
            isUnique: { type: Boolean, default: true },
        }],
    engagements: [{
            type: {
                type: String,
                enum: ['like', 'comment', 'share', 'download', 'connect', 'message'],
                required: true,
            },
            timestamp: { type: Date, required: true },
            user: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
            metadata: mongoose_1.Schema.Types.Mixed,
        }],
    metrics: {
        totalViews: { type: Number, default: 0 },
        uniqueViews: { type: Number, default: 0 },
        totalEngagements: { type: Number, default: 0 },
        avgViewDuration: { type: Number, default: 0 },
        connectionRate: { type: Number, default: 0 },
        responseRate: { type: Number, default: 0 },
        popularSections: { type: Map, of: Number },
    },
    dailyStats: [{
            date: { type: Date, required: true },
            views: { type: Number, default: 0 },
            uniqueViews: { type: Number, default: 0 },
            engagements: { type: Map, of: Number },
        }],
    lastUpdated: { type: Date, default: Date.now },
});
// Indexes for better query performance
analyticsSchema.index({ 'views.timestamp': -1 });
analyticsSchema.index({ 'engagements.timestamp': -1 });
analyticsSchema.index({ 'dailyStats.date': -1 });
analyticsSchema.index({ profileId: 1, 'views.timestamp': -1 });
analyticsSchema.index({ ownerId: 1, 'metrics.totalViews': -1 });
// Method to update metrics
analyticsSchema.methods.updateMetrics = async function () {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));
    // Calculate metrics
    const recentViews = this.views.filter((v) => v.timestamp >= thirtyDaysAgo);
    const recentEngagements = this.engagements.filter((e) => e.timestamp >= thirtyDaysAgo);
    this.metrics = {
        totalViews: this.views.length,
        uniqueViews: this.views.filter((v) => v.isUnique).length,
        totalEngagements: this.engagements.length,
        avgViewDuration: this.calculateAverageViewDuration(recentViews),
        connectionRate: this.calculateConnectionRate(recentEngagements),
        responseRate: this.calculateResponseRate(recentEngagements),
        popularSections: this.calculatePopularSections(),
    };
    this.lastUpdated = new Date();
    await this.save();
};
// Helper methods for metric calculations
analyticsSchema.methods.calculateAverageViewDuration = function (views) {
    const viewsWithDuration = views.filter(v => v.duration);
    if (viewsWithDuration.length === 0)
        return 0;
    const totalDuration = viewsWithDuration.reduce((sum, v) => sum + (v.duration || 0), 0);
    return totalDuration / viewsWithDuration.length;
};
analyticsSchema.methods.calculateConnectionRate = function (engagements) {
    const uniqueViewers = new Set(this.views.filter((v) => v.viewer).map((v) => { var _a; return (_a = v.viewer) === null || _a === void 0 ? void 0 : _a.toString(); }));
    const connections = engagements.filter(e => e.type === 'connect');
    return uniqueViewers.size ? (connections.length / uniqueViewers.size) * 100 : 0;
};
analyticsSchema.methods.calculateResponseRate = function (engagements) {
    const messages = engagements.filter(e => e.type === 'message');
    const uniqueSenders = new Set(messages.map(m => m.user.toString()));
    return messages.length ? (uniqueSenders.size / messages.length) * 100 : 0;
};
analyticsSchema.methods.calculatePopularSections = function () {
    // Implementation depends on how section views are tracked
    return {};
};
exports.Analytics = mongoose_1.default.model('Analytics', analyticsSchema);
