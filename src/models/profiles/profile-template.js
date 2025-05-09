"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfileTemplate = exports.PROFILE_TYPE_ENUM = void 0;
var mongoose_1 = require("mongoose");
exports.PROFILE_TYPE_ENUM = [
    // individual
    'personal', 'academic', 'work', 'professional', 'proprietor',
    'freelancer', 'artist', 'influencer', 'athlete', 'provider',
    'merchant', 'vendor', "dummy",
    // accessory
    'emergency', 'medical', 'pet', 'ecommerce', 'home', 'transportation',
    'driver', 'event', 'dependent', 'rider',
    // group
    'group', 'team', 'family', 'neighborhood', 'company', 'business',
    'association', 'organization', 'institution', 'community'
];
var FieldSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    label: { type: String, required: true },
    widget: { type: String, required: true },
    content: { type: mongoose_1.Schema.Types.Mixed },
    order: { type: Number, required: true },
    enabled: { type: Boolean, default: false },
    required: { type: Boolean, default: false },
    default: { type: mongoose_1.Schema.Types.Mixed },
    placeholder: { type: String },
    options: [{
            label: { type: String, required: true },
            value: mongoose_1.Schema.Types.Mixed
        }],
    validation: {
        min: Number,
        max: Number,
        regex: String
    }
}, { _id: false });
var CategorySchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    label: { type: String, required: true },
    icon: String,
    collapsible: { type: Boolean, default: true },
    fields: { type: [FieldSchema], default: [] }
}, { _id: false });
var TemplateSchema = new mongoose_1.Schema({
    profileCategory: {
        type: String,
        enum: ['individual', 'accessory', 'group'],
        required: true,
        index: true
    },
    profileType: {
        type: String,
        enum: exports.PROFILE_TYPE_ENUM,
        required: true,
        index: true
    },
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    categories: { type: [CategorySchema], default: [] },
    createdBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'SuperAdmin', required: true },
    updatedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'SuperAdmin' }
}, { timestamps: true });
TemplateSchema.index({ profileCategory: 1, profileType: 1 }, { unique: true });
exports.ProfileTemplate = mongoose_1.default.model('ProfileTemplate', TemplateSchema);
