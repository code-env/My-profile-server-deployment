import express from 'express';
import {
  getHubState,
  getSupplyLogs,
  issueMyPts,
  moveToCirculation,
  moveToReserve,
  adjustMaxSupply,
  updateValuePerMyPt,
  verifySystemConsistency,
  reconcileSupply
} from '../controllers/my-pts-hub.controller';
import { protect } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { z } from 'zod';

const router = express.Router();

// Validation schemas
const issueMyPtsSchema = z.object({
  amount: z.number().positive('Amount must be greater than zero'),
  reason: z.string().min(5, 'Reason must be at least 5 characters'),
  metadata: z.record(z.any()).optional()
});

const moveMyPtsSchema = z.object({
  amount: z.number().positive('Amount must be greater than zero'),
  reason: z.string().min(5, 'Reason must be at least 5 characters'),
  metadata: z.record(z.any()).optional()
});

const adjustMaxSupplySchema = z.object({
  maxSupply: z.number().positive('Max supply must be greater than zero').nullable(),
  reason: z.string().min(5, 'Reason must be at least 5 characters')
});

const updateValueSchema = z.object({
  value: z.number().positive('Value must be greater than zero')
});

const reconcileSupplySchema = z.object({
  reason: z.string().min(5, 'Reason must be at least 5 characters')
});

// Public routes
router.get('/state', getHubState);

// Admin routes
router.get('/logs', protect, getSupplyLogs);
router.post('/issue', protect, validateRequest(issueMyPtsSchema), issueMyPts);
router.post('/move-to-circulation', protect, validateRequest(moveMyPtsSchema), moveToCirculation);
router.post('/move-to-reserve', protect, validateRequest(moveMyPtsSchema), moveToReserve);
router.post('/adjust-max-supply', protect, validateRequest(adjustMaxSupplySchema), adjustMaxSupply);
router.post('/update-value', protect, validateRequest(updateValueSchema), updateValuePerMyPt);
router.get('/verify-consistency', protect, verifySystemConsistency);
router.post('/reconcile', protect, validateRequest(reconcileSupplySchema), reconcileSupply);

export default router;
