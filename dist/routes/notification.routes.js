"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const notification_controller_1 = require("../controllers/notification.controller");
const router = express_1.default.Router();
router.use(auth_middleware_1.protect);
router.route('/')
    .get(notification_controller_1.getNotifications);
router.route('/read-all')
    .put(notification_controller_1.markAllAsRead);
router.route('/:id/read')
    .put(notification_controller_1.markAsRead);
router.route('/:id/archive')
    .put(notification_controller_1.archiveNotification);
router.route('/:id')
    .delete(notification_controller_1.deleteNotification);
exports.default = router;
