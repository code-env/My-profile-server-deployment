"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var mongoose_1 = require("mongoose");
var config_1 = require("../config/config");
var profile_template_1 = require("../models/profiles/profile-template");
var logger_1 = require("../utils/logger");
/**
 * Creates a default personal profile template if it doesn't exist
 */
function createDefaultProfileTemplate() {
    return __awaiter(this, void 0, void 0, function () {
        var existingTemplate, adminId, template, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 4, 5, 7]);
                    // Connect to MongoDB
                    return [4 /*yield*/, mongoose_1.default.connect(config_1.config.MONGODB_URI)];
                case 1:
                    // Connect to MongoDB
                    _a.sent();
                    logger_1.logger.info('Connected to MongoDB');
                    return [4 /*yield*/, profile_template_1.ProfileTemplate.findOne({
                            profileType: 'personal',
                            profileCategory: 'individual'
                        })];
                case 2:
                    existingTemplate = _a.sent();
                    if (existingTemplate) {
                        logger_1.logger.info('Default personal profile template already exists:', existingTemplate._id);
                        return [2 /*return*/, existingTemplate];
                    }
                    adminId = new mongoose_1.default.Types.ObjectId();
                    return [4 /*yield*/, profile_template_1.ProfileTemplate.create({
                            profileCategory: 'individual',
                            profileType: 'personal',
                            name: 'Personal Profile',
                            slug: 'personal-profile',
                            createdBy: adminId,
                            categories: [
                                {
                                    name: 'basic',
                                    label: 'Basic Information',
                                    icon: 'user',
                                    collapsible: true,
                                    fields: [
                                        {
                                            name: 'fullName',
                                            label: 'Full Name',
                                            widget: 'text',
                                            order: 1,
                                            enabled: true,
                                            required: true,
                                            placeholder: 'Enter your full name'
                                        },
                                        {
                                            name: 'bio',
                                            label: 'Bio',
                                            widget: 'textarea',
                                            order: 2,
                                            enabled: true,
                                            required: false,
                                            placeholder: 'Tell us about yourself'
                                        },
                                        {
                                            name: 'dateOfBirth',
                                            label: 'Date of Birth',
                                            widget: 'date',
                                            order: 3,
                                            enabled: true,
                                            required: false
                                        },
                                        {
                                            name: 'gender',
                                            label: 'Gender',
                                            widget: 'select',
                                            order: 4,
                                            enabled: true,
                                            required: false,
                                            options: [
                                                { label: 'Male', value: 'male' },
                                                { label: 'Female', value: 'female' },
                                                { label: 'Non-binary', value: 'non-binary' },
                                                { label: 'Prefer not to say', value: 'not-specified' }
                                            ]
                                        }
                                    ]
                                },
                                {
                                    name: 'contact',
                                    label: 'Contact Information',
                                    icon: 'phone',
                                    collapsible: true,
                                    fields: [
                                        {
                                            name: 'email',
                                            label: 'Email',
                                            widget: 'email',
                                            order: 1,
                                            enabled: true,
                                            required: false,
                                            placeholder: 'Enter your email'
                                        },
                                        {
                                            name: 'phone',
                                            label: 'Phone',
                                            widget: 'phone',
                                            order: 2,
                                            enabled: true,
                                            required: false,
                                            placeholder: 'Enter your phone number'
                                        },
                                        {
                                            name: 'address',
                                            label: 'Address',
                                            widget: 'textarea',
                                            order: 3,
                                            enabled: true,
                                            required: false,
                                            placeholder: 'Enter your address'
                                        }
                                    ]
                                },
                                {
                                    name: 'social',
                                    label: 'Social Media',
                                    icon: 'share',
                                    collapsible: true,
                                    fields: [
                                        {
                                            name: 'linkedin',
                                            label: 'LinkedIn',
                                            widget: 'url',
                                            order: 1,
                                            enabled: true,
                                            required: false,
                                            placeholder: 'Your LinkedIn profile URL'
                                        },
                                        {
                                            name: 'twitter',
                                            label: 'Twitter',
                                            widget: 'url',
                                            order: 2,
                                            enabled: true,
                                            required: false,
                                            placeholder: 'Your Twitter profile URL'
                                        },
                                        {
                                            name: 'facebook',
                                            label: 'Facebook',
                                            widget: 'url',
                                            order: 3,
                                            enabled: true,
                                            required: false,
                                            placeholder: 'Your Facebook profile URL'
                                        },
                                        {
                                            name: 'instagram',
                                            label: 'Instagram',
                                            widget: 'url',
                                            order: 4,
                                            enabled: true,
                                            required: false,
                                            placeholder: 'Your Instagram profile URL'
                                        }
                                    ]
                                }
                            ]
                        })];
                case 3:
                    template = _a.sent();
                    logger_1.logger.info('Created default personal profile template:', template._id);
                    return [2 /*return*/, template];
                case 4:
                    error_1 = _a.sent();
                    logger_1.logger.error('Error creating default personal profile template:', error_1);
                    throw error_1;
                case 5: 
                // Disconnect from MongoDB
                return [4 /*yield*/, mongoose_1.default.disconnect()];
                case 6:
                    // Disconnect from MongoDB
                    _a.sent();
                    logger_1.logger.info('Disconnected from MongoDB');
                    return [7 /*endfinally*/];
                case 7: return [2 /*return*/];
            }
        });
    });
}
// Run the script
createDefaultProfileTemplate()
    .then(function (template) {
    logger_1.logger.info('Script completed successfully');
    console.log('Template ID:', template._id);
    process.exit(0);
})
    .catch(function (error) {
    logger_1.logger.error('Script failed:', error);
    process.exit(1);
});
