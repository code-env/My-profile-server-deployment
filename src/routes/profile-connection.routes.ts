import express from 'express';
import { protect } from '../middleware/auth.middleware';
import {
  sendConnectionRequest,
  acceptConnectionRequest,
  rejectConnectionRequest,
  blockConnection,
  unblockConnection,
  getProfileConnections,
  checkProfilesConnected,
  getConnectionRequests,
  getConnectedProfiles
} from '../controllers/profile-connection.controller';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Send a connection request
router.post('/profiles/:profileId/connections/request', sendConnectionRequest);

// Accept a connection request
router.post('/connections/:connectionId/accept', acceptConnectionRequest);

// Reject a connection request
router.post('/connections/:connectionId/reject', rejectConnectionRequest);

// Block a connection
router.post('/profiles/:profileId/connections/block', blockConnection);

// Unblock a connection
router.post('/connections/:connectionId/unblock', unblockConnection);

// Get all connections for a profile
router.get('/profiles/:profileId/connections', getProfileConnections);

// Check if two profiles are connected
router.get('/profiles/:profileId/connected/:targetProfileId', checkProfilesConnected);

// Get connection requests for a profile
router.get('/profiles/:profileId/connections/requests', getConnectionRequests);

// Get connected profiles
router.get('/profiles/:profileId/connected-profiles', getConnectedProfiles);

export default router;
