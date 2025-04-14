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
exports.Connection = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const connectionSchema = new mongoose_1.Schema({
    fromUser: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Users',
        required: true,
    },
    toProfile: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Profile',
        required: true,
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected', 'blocked'],
        default: 'pending',
    },
    connectionType: {
        type: String,
        enum: ['follow', 'connect', 'business', 'donation'],
        required: true,
    },
    message: {
        type: String,
        trim: true,
    },
    amount: {
        type: Number,
        min: 0,
    },
    employmentDetails: {
        position: String,
        company: String,
        salary: String,
        startDate: Date,
    },
    metadata: {
        type: Map,
        of: mongoose_1.Schema.Types.Mixed,
    },
    lastInteractionAt: {
        type: Date,
        default: Date.now,
    },
    interactionStats: {
        views: { type: Number, default: 0 },
        messages: { type: Number, default: 0 },
        engagements: { type: Number, default: 0 },
        endorsements: { type: Number, default: 0 },
        shares: { type: Number, default: 0 },
    },
    strengthScores: [{
            score: Number,
            timestamp: { type: Date, default: Date.now },
            factors: {
                interactionFrequency: Number,
                mutualConnections: Number,
                engagementDuration: Number,
                sharedInterests: Number,
                messageFrequency: Number,
            },
        }],
}, {
    timestamps: true,
});
// Indexes
connectionSchema.index({ fromUser: 1, toProfile: 1 }, { unique: true });
connectionSchema.index({ status: 1 });
connectionSchema.index({ lastInteractionAt: 1 });
exports.Connection = mongoose_1.default.model('Connections', connectionSchema);
