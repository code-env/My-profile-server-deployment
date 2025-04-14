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
exports.ProfileTemplate = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const profileTemplateSchema = new mongoose_1.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
        required: true,
    },
    category: {
        type: String,
        required: true,
        enum: ['business', 'personal', 'portfolio', 'resume', 'company', 'other'],
    },
    fields: [{
            name: { type: String, required: true },
            type: {
                type: String,
                required: true,
                enum: ['text', 'number', 'date', 'boolean', 'array', 'object']
            },
            required: { type: Boolean, default: false },
            label: { type: String, required: true },
            placeholder: String,
            options: [String],
            defaultValue: mongoose_1.Schema.Types.Mixed,
        }],
    layout: {
        sections: [{
                title: { type: String, required: true },
                fields: [String],
                order: { type: Number, required: true },
            }],
    },
    settings: {
        defaultVisibility: {
            type: String,
            enum: ['public', 'private', 'connections'],
            default: 'private',
        },
        defaultTheme: {
            type: String,
            default: 'default',
        },
        allowedModules: [String],
    },
    createdBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    isPublic: {
        type: Boolean,
        default: false,
    },
    usageCount: {
        type: Number,
        default: 0,
    },
    tags: [String],
}, {
    timestamps: true,
});
// Index for better search performance
profileTemplateSchema.index({ name: 'text', description: 'text', tags: 'text' });
profileTemplateSchema.index({ category: 1, isPublic: 1 });
profileTemplateSchema.index({ usageCount: -1 });
exports.ProfileTemplate = mongoose_1.default.model('ProfileTemplate', profileTemplateSchema);
