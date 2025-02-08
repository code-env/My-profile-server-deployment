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
exports.DeviceModel = void 0;
/**
 * Device Model - Represents an IoT device in the system
 * @module models/device
 */
const mongoose_1 = __importStar(require("mongoose"));
const deviceSchema = new mongoose_1.Schema({
    profileId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Profile',
        required: true,
    },
    deviceType: {
        type: String,
        enum: ['smartwatch', 'smartphone', 'tablet', 'laptop', 'other'],
        required: true,
    },
    deviceId: {
        type: String,
        required: true,
        unique: true,
    },
    deviceName: {
        type: String,
        required: true,
    },
    manufacturer: String,
    model: String,
    osVersion: String,
    lastSync: {
        type: Date,
        default: Date.now,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    settings: {
        notifications: {
            type: Boolean,
            default: true,
        },
        dataSync: {
            type: Boolean,
            default: true,
        },
        locationTracking: {
            type: Boolean,
            default: false,
        },
        healthMetrics: {
            type: Boolean,
            default: true,
        },
    },
    healthData: {
        lastUpdate: Date,
        steps: Number,
        heartRate: Number,
        sleep: [{
                startTime: Date,
                endTime: Date,
                quality: {
                    type: String,
                    enum: ['light', 'deep', 'rem'],
                },
            }],
    },
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {},
    },
}, {
    timestamps: true,
});
// Indexes for better query performance
deviceSchema.index({ profileId: 1, deviceType: 1 });
deviceSchema.index({ deviceId: 1 }, { unique: true });
exports.DeviceModel = mongoose_1.default.model('Device', deviceSchema);
