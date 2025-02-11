import { Router } from 'express';
import { getLogFile, deleteLogFile } from '../controllers/logs.controller';

const router = Router();

// Get log file contents with pagination
router.get('/files/:filename', getLogFile);

// Delete/clear log file
router.delete('/files/:filename', deleteLogFile);

export default router;
