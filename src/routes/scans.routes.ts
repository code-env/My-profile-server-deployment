import { Router } from 'express';
import {
  createScan,
  getProfileScans,
  getScanById,
  updateScan,
  deleteScan,
  getScanStats
} from '../controllers/scans.controller';

const router = Router();

/**
 * @route   POST /api/profiles/:profileId/scans
 * @desc    Create a new scan for a profile
 * @access  Private
 * @body    {
 *   type: 'badge' | 'doc' | 'qrcode' | 'card',
 *   text?: string, // For QR codes
 *   fileData?: string, // Base64 file data for file-based scans
 *   fileName?: string,
 *   fileType?: string,
 *   fileSize?: number,
 *   metadata?: object
 * }
 */
router.post('/:profileId/scans', createScan);

/**
 * @route   GET /api/profiles/:profileId/scans
 * @desc    Get all scans for a profile
 * @access  Private
 * @query   {
 *   type?: 'badge' | 'doc' | 'qrcode' | 'card',
 *   limit?: number,
 *   skip?: number,
 *   sort?: string
 * }
 */
router.get('/:profileId/scans', getProfileScans);

/**
 * @route   GET /api/profiles/:profileId/scans/stats
 * @desc    Get scan statistics for a profile
 * @access  Private
 */
router.get('/:profileId/scans/stats', getScanStats);

/**
 * @route   GET /api/scans/:scanId
 * @desc    Get a specific scan by ID
 * @access  Private
 */
router.get('/scans/:scanId', getScanById);

/**
 * @route   PUT /api/scans/:scanId
 * @desc    Update scan metadata
 * @access  Private
 * @body    {
 *   metadata?: object
 * }
 */
router.put('/scans/:scanId', updateScan);

/**
 * @route   DELETE /api/scans/:scanId
 * @desc    Delete a scan and its associated file
 * @access  Private
 */
router.delete('/scans/:scanId', deleteScan);

export default router;
