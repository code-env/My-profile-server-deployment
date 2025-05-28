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
exports.Security = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const securitySchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: String,
    twoFactorBackupCodes: [String],
    biometricEnabled: { type: Boolean, default: false },
    biometricData: {
        fingerprint: {
            hash: String,
            lastVerified: Date,
        },
        faceId: {
            hash: String,
            lastVerified: Date,
        },
        voicePrint: {
            hash: String,
            lastVerified: Date,
        },
    },
    lastLogin: Date,
    lastPasswordChange: Date,
    passwordHistory: [String],
    securityQuestions: [{
            question: String,
            answer: String,
        }],
    ipWhitelist: [String],
    deviceWhitelist: [{
            deviceId: String,
            deviceName: String,
            lastUsed: Date,
        }],
    loginAttempts: { type: Number, default: 0 },
    lockoutUntil: Date,
    auditLog: [{
            action: String,
            timestamp: Date,
            ip: String,
            deviceId: String,
            success: Boolean,
            details: mongoose_1.Schema.Types.Mixed,
        }],
}, {
    timestamps: true,
});
// Indexes
securitySchema.index({ userId: 1 }, { unique: true });
securitySchema.index({ 'deviceWhitelist.deviceId': 1 });
securitySchema.index({ lockoutUntil: 1 });
exports.Security = mongoose_1.default.model('Security', securitySchema);
