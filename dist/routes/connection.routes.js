"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const connection_controller_1 = require("../controllers/connection.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = express_1.default.Router();
// Connect via QR code
router.post('/qr/:profileId', auth_middleware_1.protect, connection_controller_1.ConnectionController.connectViaQR);
// Connect via link
router.post('/link/:profileId', auth_middleware_1.protect, connection_controller_1.ConnectionController.connectViaLink);
// Request direct connection
router.post('/request', auth_middleware_1.protect, connection_controller_1.ConnectionController.requestConnection);
// Accept or reject a connection request
router.put('/:connectionId/status', auth_middleware_1.protect, connection_controller_1.ConnectionController.updateConnectionStatus);
// Get all connections for a user (sent and received)
router.get('/my-connections', auth_middleware_1.protect, connection_controller_1.ConnectionController.getUserConnections);
// Get pending connection requests
router.get('/pending', auth_middleware_1.protect, connection_controller_1.ConnectionController.getPendingConnections);
// Get connection stats
router.get('/stats', auth_middleware_1.protect, connection_controller_1.ConnectionController.getConnectionStats);
// Remove a connection
router.delete('/:connectionId', auth_middleware_1.protect, connection_controller_1.ConnectionController.removeConnection);
// Get connection suggestions
router.get('/suggestions', auth_middleware_1.protect, connection_controller_1.ConnectionController.getConnectionSuggestions);
// Get profile connections with type filter and pagination
router.get('/profile/:profileId', auth_middleware_1.protect, connection_controller_1.ConnectionController.getProfileConnections);
exports.default = router;
