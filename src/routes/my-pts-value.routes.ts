import express from 'express';
import {
  getCurrentValue,
  getHistoricalValues,
  calculateValue,
  convertToMyPts,
  getTotalSupply,
  updateMyPtsValue,
  initializeMyPtsValue,
  updateExchangeRates,
  getSupportedCurrencies
} from '../controllers/my-pts-value.controller';
import { protect } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { z } from 'zod';

const router = express.Router();

// Validation schemas
const updateValueSchema = z.object({
  baseValue: z.number().positive('Base value must be positive'),
  exchangeRates: z.array(
    z.object({
      currency: z.string().min(3, 'Currency code must be at least 3 characters'),
      rate: z.number().positive('Exchange rate must be positive'),
      symbol: z.string().min(1, 'Currency symbol is required'),
      updatedAt: z.date().optional()
    })
  ),
  totalSupply: z.number().positive('Total supply must be positive').optional()
});

const updateExchangeRatesSchema = z.object({
  exchangeRates: z.array(
    z.object({
      currency: z.string().min(3, 'Currency code must be at least 3 characters'),
      rate: z.number().positive('Exchange rate must be positive'),
      symbol: z.string().min(1, 'Currency symbol is required')
    })
  )
});

// Public routes
router.get('/current', getCurrentValue);
router.get('/calculate', calculateValue);
router.get('/convert', convertToMyPts);
router.get('/total-supply', getTotalSupply);
router.get('/currencies', getSupportedCurrencies);

// Protected routes
router.get('/historical', protect, getHistoricalValues);

// Admin routes
router.post('/update', protect, validateRequest(updateValueSchema), updateMyPtsValue);
router.post('/initialize', protect, initializeMyPtsValue);
router.post('/exchange-rates', protect, validateRequest(updateExchangeRatesSchema), updateExchangeRates);

export default router;
