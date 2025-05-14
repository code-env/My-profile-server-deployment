import express from 'express';
import { getPlans, getPlanById } from '../controllers/plans.controller';
import { authenticateToken } from '../middleware/authMiddleware';

const router = express.Router();

// Plans routes
router.get('/', authenticateToken, getPlans);
router.get('/:id', authenticateToken, getPlanById);

export default router; 