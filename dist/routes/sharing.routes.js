"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const sharing_controller_1 = require("../controllers/sharing.controller");
const router = express_1.default.Router();
// Protected routes (require authentication)
router.post('/:profileId/qr', auth_middleware_1.protect, sharing_controller_1.generateQRCode);
router.post('/:profileId/image', auth_middleware_1.protect, sharing_controller_1.generateSharingImage);
// Public routes (optional authentication)
router.post('/:profileId/track', auth_middleware_1.optionalAuth, sharing_controller_1.trackShare);
router.get('/:profileId/meta', sharing_controller_1.getSharingMetadata);
exports.default = router;
