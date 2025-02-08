"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const connection_analytics_controller_1 = require("../controllers/connection-analytics.controller");
const router = express_1.default.Router();
// Get connection strength
router.get('/strength/:connectionId', auth_middleware_1.protect, connection_analytics_controller_1.ConnectionAnalyticsController.getConnectionStrength);
// Get connection strength history
router.get('/history/:connectionId', auth_middleware_1.protect, connection_analytics_controller_1.ConnectionAnalyticsController.getStrengthHistory);
exports.default = router;
