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
    fromProfile: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Profile',
        required: true,
    },
    toProfile: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Profile',
        required: true,
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected'],
        default: 'pending',
    },
    connectionType: {
        type: String,
        enum: ['follow', 'connect'],
        required: true,
    },
    connectionCategory: {
        type: String,
        enum: ['connection', 'affiliation'],
        required: true,
    },
    metadata: {
        type: Map,
        of: mongoose_1.Schema.Types.Mixed,
    },
    source: {
        type: String,
        enum: ['link', 'qrcode', 'direct'],
        default: 'direct',
    },
}, {
    timestamps: true,
});
// Indexes
connectionSchema.index({ fromProfile: 1, toProfile: 1 }, { unique: true });
connectionSchema.index({ status: 1 });
exports.Connection = mongoose_1.default.model('Connections', connectionSchema);
