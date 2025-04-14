import express from 'express';
import { SearchController } from '../controllers/search.controller';
import { optionalAuth } from '../middleware/authMiddleware';

const router = express.Router();

// Search profiles - accessible to both authenticated and unauthenticated users
router.get('/profiles', optionalAuth, SearchController.searchProfiles);

export default router;
