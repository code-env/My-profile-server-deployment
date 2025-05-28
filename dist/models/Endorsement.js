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
exports.Endorsement = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const endorsementSchema = new mongoose_1.Schema({
    recipient: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    endorser: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    skill: {
        type: String,
        required: true,
        trim: true,
    },
    level: {
        type: String,
        enum: ['beginner', 'intermediate', 'expert'],
        required: true,
    },
    relationship: {
        type: String,
        required: true,
        enum: [
            'colleague',
            'manager',
            'client',
            'mentor',
            'academic',
            'other'
        ],
    },
    comment: {
        type: String,
        maxlength: 500,
    },
    isVerified: {
        type: Boolean,
        default: false,
    },
    weight: {
        type: Number,
        default: 1,
        min: 0,
        max: 10,
    },
    endorsedAt: {
        type: Date,
        default: Date.now,
    },
    lastUpdated: {
        type: Date,
        default: Date.now,
    },
}, {
    timestamps: true,
});
// Indexes for better query performance
endorsementSchema.index({ recipient: 1, skill: 1 });
endorsementSchema.index({ endorser: 1, recipient: 1 }, { unique: true });
endorsementSchema.index({ skill: 'text' });
// Prevent self-endorsement
endorsementSchema.pre('save', function (next) {
    if (this.recipient.equals(this.endorser)) {
        next(new Error('Self-endorsement is not allowed'));
    }
    next();
});
// Update lastUpdated timestamp on modifications
endorsementSchema.pre('save', function (next) {
    if (this.isModified()) {
        this.lastUpdated = new Date();
    }
    next();
});
exports.Endorsement = mongoose_1.default.model('Endorsement', endorsementSchema);
