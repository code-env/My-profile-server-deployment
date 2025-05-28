"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const analytics_controller_1 = require("../controllers/analytics.controller");
const router = express_1.default.Router();
router.use(auth_middleware_1.protect);
// Profile-specific analytics
router.route('/profiles/:id/view')
    .post(analytics_controller_1.trackProfileView);
router.route('/profiles/:id/engage')
    .post(analytics_controller_1.trackEngagement);
router.route('/profiles/:id')
    .get(analytics_controller_1.getProfileAnalytics);
// User analytics
router.route('/user')
    .get(analytics_controller_1.getUserAnalytics);
exports.default = router;
