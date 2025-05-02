"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationController = void 0;
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const http_errors_1 = __importDefault(require("http-errors"));
const notification_service_1 = require("../services/notification.service");
const mongoose_1 = __importDefault(require("mongoose"));
const notificationService = new notification_service_1.NotificationService();
// Create a NotificationController object to export
exports.NotificationController = {
    getUserNotifications: (0, express_async_handler_1.default)(async (req, res) => {
        const user = req.user;
        const { isRead, isArchived, page, limit } = req.query;
        const result = await notificationService.getUserNotifications(user._id, {
            isRead: isRead === 'true',
            isArchived: isArchived === 'true',
            page: Number(page) || 1,
            limit: Number(limit) || 10,
        });
        res.json(result);
    }),
    markNotificationAsRead: (0, express_async_handler_1.default)(async (req, res) => {
        const user = req.user;
        const { id } = req.params;
        const notification = await notificationService.markAsRead(new mongoose_1.default.Types.ObjectId(id), user._id);
        if (!notification) {
            throw (0, http_errors_1.default)(404, 'Notification not found');
        }
        res.json(notification);
    }),
    markAllNotificationsAsRead: (0, express_async_handler_1.default)(async (req, res) => {
        const user = req.user;
        await notificationService.markAllAsRead(user._id);
        res.json({ message: 'All notifications marked as read' });
    }),
    archiveNotification: (0, express_async_handler_1.default)(async (req, res) => {
        const user = req.user;
        const { id } = req.params;
        const notification = await notificationService.archiveNotification(new mongoose_1.default.Types.ObjectId(id), user._id);
        if (!notification) {
            throw (0, http_errors_1.default)(404, 'Notification not found');
        }
        res.json(notification);
    }),
    deleteNotification: (0, express_async_handler_1.default)(async (req, res) => {
        const user = req.user;
        const { id } = req.params;
        const notification = await notificationService.deleteNotification(new mongoose_1.default.Types.ObjectId(id), user._id);
        if (!notification) {
            throw (0, http_errors_1.default)(404, 'Notification not found');
        }
        res.json({ message: 'Notification deleted' });
    }),
    getUnreadNotificationsCount: (0, express_async_handler_1.default)(async (req, res) => {
        const user = req.user;
        const count = await notificationService.getUnreadCount(user._id);
        res.json({
            success: true,
            data: {
                count
            }
        });
    })
};
