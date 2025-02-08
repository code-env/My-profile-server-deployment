import express from 'express';
import { ConnectionController } from '../controllers/connection.controller';
import { protect } from '../middleware/auth.middleware';

const router = express.Router();

// Connect via QR code
router.post('/qr/:profileId', protect, ConnectionController.connectViaQR);

// Connect via link
router.post('/link/:profileId', protect, ConnectionController.connectViaLink);

// Request direct connection
router.post('/request', protect, ConnectionController.requestConnection);

// Accept or reject a connection request
router.put('/:connectionId/status', protect, ConnectionController.updateConnectionStatus);

// Get all connections for a user (sent and received)
router.get('/my-connections', protect, ConnectionController.getUserConnections);

// Get pending connection requests
router.get('/pending', protect, ConnectionController.getPendingConnections);

// Get connection stats
router.get('/stats', protect, ConnectionController.getConnectionStats);

// Remove a connection
router.delete('/:connectionId', protect, ConnectionController.removeConnection);

// Get connection suggestions
router.get('/suggestions', protect, ConnectionController.getConnectionSuggestions);

// Get profile connections with type filter and pagination
router.get('/profile/:profileId', protect, ConnectionController.getProfileConnections);

export default router;
