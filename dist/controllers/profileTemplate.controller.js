"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteTemplate = exports.updateTemplate = exports.getTemplateById = exports.getTemplates = exports.createTemplate = void 0;
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const http_errors_1 = __importDefault(require("http-errors"));
const ProfileTemplate_1 = require("../models/ProfileTemplate");
const logger_1 = require("../utils/logger");
// @desc    Create a new profile template
// @route   POST /api/templates
// @access  Private (Admin/SuperAdmin)
exports.createTemplate = (0, express_async_handler_1.default)(async (req, res) => {
    const user = req.user;
    // Only admin and superadmin can create templates
    if (user.role !== 'admin' && user.role !== 'superadmin') {
        throw (0, http_errors_1.default)(403, 'Not authorized to create templates');
    }
    const template = await ProfileTemplate_1.ProfileTemplate.create({
        ...req.body,
        createdBy: user._id,
    });
    logger_1.logger.info(`Template created: ${template._id} by user: ${user._id}`);
    res.status(201).json(template);
});
// @desc    Get all public templates
// @route   GET /api/templates
// @access  Private
exports.getTemplates = (0, express_async_handler_1.default)(async (req, res) => {
    const { category, search, sort = 'usageCount' } = req.query;
    const query = { isPublic: true };
    // Apply category filter
    if (category) {
        query.category = category;
    }
    // Apply search filter
    if (search) {
        query.$text = { $search: search };
    }
    // Apply sorting
    let sortOption = {};
    switch (sort) {
        case 'newest':
            sortOption = { createdAt: -1 };
            break;
        case 'popular':
            sortOption = { usageCount: -1 };
            break;
        case 'name':
            sortOption = { name: 1 };
            break;
        default:
            sortOption = { usageCount: -1 };
    }
    const templates = await ProfileTemplate_1.ProfileTemplate.find(query)
        .sort(sortOption)
        .select('-fields -layout') // Exclude detailed fields for list view
        .lean();
    res.json(templates);
});
// @desc    Get template by ID
// @route   GET /api/templates/:id
// @access  Private
exports.getTemplateById = (0, express_async_handler_1.default)(async (req, res) => {
    const template = await ProfileTemplate_1.ProfileTemplate.findById(req.params.id);
    if (!template) {
        throw (0, http_errors_1.default)(404, 'Template not found');
    }
    if (!template.isPublic) {
        const user = req.user;
        if (template.createdBy.toString() !== user._id.toString() &&
            user.role !== 'admin' && user.role !== 'superadmin') {
            throw (0, http_errors_1.default)(403, 'Not authorized to view this template');
        }
    }
    res.json(template);
});
// @desc    Update template
// @route   PUT /api/templates/:id
// @access  Private (Admin/SuperAdmin/Owner)
exports.updateTemplate = (0, express_async_handler_1.default)(async (req, res) => {
    const user = req.user;
    const template = await ProfileTemplate_1.ProfileTemplate.findById(req.params.id);
    if (!template) {
        throw (0, http_errors_1.default)(404, 'Template not found');
    }
    // Check authorization
    if (template.createdBy.toString() !== user._id.toString() &&
        user.role !== 'admin' && user.role !== 'superadmin') {
        throw (0, http_errors_1.default)(403, 'Not authorized to update this template');
    }
    const updatedTemplate = await ProfileTemplate_1.ProfileTemplate.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    logger_1.logger.info(`Template updated: ${template._id} by user: ${user._id}`);
    res.json(updatedTemplate);
});
// @desc    Delete template
// @route   DELETE /api/templates/:id
// @access  Private (Admin/SuperAdmin/Owner)
exports.deleteTemplate = (0, express_async_handler_1.default)(async (req, res) => {
    const user = req.user;
    const template = await ProfileTemplate_1.ProfileTemplate.findById(req.params.id);
    if (!template) {
        throw (0, http_errors_1.default)(404, 'Template not found');
    }
    // Check authorization
    if (template.createdBy.toString() !== user._id.toString() &&
        user.role !== 'admin' && user.role !== 'superadmin') {
        throw (0, http_errors_1.default)(403, 'Not authorized to delete this template');
    }
    await template.remove();
    logger_1.logger.info(`Template deleted: ${template._id} by user: ${user._id}`);
    res.json({ message: 'Template removed' });
});
