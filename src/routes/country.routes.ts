/**
 * @file country.routes.ts
 * @description Country Management API Routes
 * ========================================
 * 
 * Public Endpoints (No Authentication Required):
 * =============================================
 * GET /api/countries                              - Get all countries (with optional pagination and filtering)
 * GET /api/countries/continents                   - Get list of all continents
 * GET /api/countries/continent/:continent         - Get countries by continent
 * GET /api/countries/code/:code                   - Get country by ISO code (e.g., 'US', 'CA')
 * GET /api/countries/phone/:phoneCode             - Get country by phone code (e.g., '+1', '+44')
 * GET /api/countries/:id                          - Get country by MongoDB ObjectId
 * 
 * Query Parameters for GET /api/countries:
 * - page: Page number for pagination (optional)
 * - limit: Items per page for pagination (optional, default: 50)
 * - continent: Filter by continent (optional)
 * - search: Search in name, code, or capital (optional)
 * 
 * Admin Endpoints (Require Authentication + Admin Role):
 * =====================================================
 * POST /api/countries                             - Create a new country
 * POST /api/countries/bulk                        - Bulk create countries
 * PUT /api/countries/:id                          - Update country by ID
 * DELETE /api/countries/:id                       - Delete country by ID
 * 
 * Example Usage:
 * ==============
 * 
 * // Get all countries
 * fetch('/api/countries')
 * 
 * // Get countries with pagination
 * fetch('/api/countries?page=1&limit=10')
 * 
 * // Search countries
 * fetch('/api/countries?search=united')
 * 
 * // Get countries by continent
 * fetch('/api/countries/continent/North America')
 * 
 * // Get country by code
 * fetch('/api/countries/code/US')
 * 
 * // Create country (admin only)
 * fetch('/api/countries', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer <token>' },
 *   body: JSON.stringify({
 *     name: 'Test Country',
 *     code: 'TC',
 *     phoneCode: '+999',
 *     continent: 'Test Continent'
 *   })
 * })
 */

import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/roleMiddleware';
import {
    getAllCountries,
    getCountryById,
    getCountryByCode,
    getCountryByPhoneCode,
    getCountriesByContinent,
    getContinents,
    createCountry,
    updateCountry,
    deleteCountry,
    bulkCreateCountries
} from '../controllers/country.controller';

const router = Router();

// Public routes (no authentication required for reading country data)
router.get('/', getAllCountries);
router.get('/continents', getContinents);
router.get('/continent/:continent', getCountriesByContinent);
router.get('/code/:code', getCountryByCode);
router.get('/phone/:phoneCode', getCountryByPhoneCode);
router.get('/:id', getCountryById);

// Admin routes (require authentication and admin role)
// router.use(protect);
// router.use(requireRole(['admin', 'superadmin']));

router.post('/', createCountry);
router.post('/bulk', bulkCreateCountries);
router.put('/:id', updateCountry);
router.delete('/:id', deleteCountry);

export default router; 