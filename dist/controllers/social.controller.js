"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserEndorsements = exports.getEndorsements = exports.createEndorsement = exports.getConnections = exports.respondToConnection = exports.sendConnectionRequest = void 0;
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const http_errors_1 = __importDefault(require("http-errors"));
const social_service_1 = require("../services/social.service");
const mongoose_1 = __importDefault(require("mongoose"));
const socialService = new social_service_1.SocialService();
// Connection Controllers
// @desc    Send connection request
// @route   POST /api/social/connections/request
// @access  Private
exports.sendConnectionRequest = (0, express_async_handler_1.default)(async (req, res) => {
    const user = req.user;
    const { recipientId, message } = req.body;
    if (user._id.toString() === recipientId) {
        throw (0, http_errors_1.default)(400, 'Cannot connect with yourself');
    }
    const connection = await socialService.sendConnectionRequest(user._id, recipientId, message);
    res.status(201).json(connection);
});
// @desc    Respond to connection request
// @route   PUT /api/social/connections/:id/respond
// @access  Private
exports.respondToConnection = (0, express_async_handler_1.default)(async (req, res) => {
    const user = req.user;
    const { id } = req.params;
    const { accept } = req.body;
    if (typeof accept !== 'boolean') {
        throw (0, http_errors_1.default)(400, 'Accept parameter must be a boolean');
    }
    const connection = await socialService.respondToConnectionRequest(user._id, new mongoose_1.default.Types.ObjectId(id), accept);
    res.json(connection);
});
// @desc    Get user connections
// @route   GET /api/social/connections
// @access  Private
exports.getConnections = (0, express_async_handler_1.default)(async (req, res) => {
    const user = req.user;
    const { status, page, limit } = req.query;
    const result = await socialService.getConnections(user._id, status ? status.split(',') : undefined, Number(page) || 1, Number(limit) || 10);
    res.json(result);
});
// Endorsement Controllers
// @desc    Create endorsement
// @route   POST /api/social/endorsements
// @access  Private
exports.createEndorsement = (0, express_async_handler_1.default)(async (req, res) => {
    const user = req.user;
    const { recipientId, skill, level, relationship, comment } = req.body;
    if (user._id.toString() === recipientId) {
        throw (0, http_errors_1.default)(400, 'Cannot endorse yourself');
    }
    if (!['beginner', 'intermediate', 'expert'].includes(level)) {
        throw (0, http_errors_1.default)(400, 'Invalid skill level');
    }
    const endorsement = await socialService.createEndorsement(user._id, recipientId, {
        skill,
        level,
        relationship,
        comment,
    });
    res.status(201).json(endorsement);
});
// @desc    Get user endorsements
// @route   GET /api/social/endorsements
// @access  Private
exports.getEndorsements = (0, express_async_handler_1.default)(async (req, res) => {
    const user = req.user;
    const { skill, level, page, limit } = req.query;
    const result = await socialService.getEndorsements(user._id, {
        skill: skill,
        level: level,
        page: Number(page) || 1,
        limit: Number(limit) || 10,
    });
    res.json(result);
});
// @desc    Get user's received endorsements
// @route   GET /api/social/endorsements/:userId
// @access  Private
exports.getUserEndorsements = (0, express_async_handler_1.default)(async (req, res) => {
    const { userId } = req.params;
    const { skill, level, page, limit } = req.query;
    const result = await socialService.getEndorsements(new mongoose_1.default.Types.ObjectId(userId), {
        skill: skill,
        level: level,
        page: Number(page) || 1,
        limit: Number(limit) || 10,
    });
    res.json(result);
});
