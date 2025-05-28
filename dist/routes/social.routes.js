"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const social_controller_1 = require("../controllers/social.controller");
const router = express_1.default.Router();
router.use(auth_middleware_1.protect);
// Connection routes
router.route("/connections").get(social_controller_1.getConnections).post(social_controller_1.sendConnectionRequest);
router.route("/connections/:id/respond").put(social_controller_1.respondToConnection);
// Endorsement routes
router.route("/endorsements").get(social_controller_1.getEndorsements).post(social_controller_1.createEndorsement);
router.route("/endorsements/:userId").get(social_controller_1.getUserEndorsements);
exports.default = router;
