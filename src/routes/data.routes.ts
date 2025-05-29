import express from 'express';
import { getProfileAnalytics } from '../controllers/data.controller';

const router = express.Router();


// Profile data routes for the data section
router.get('/:profileId', getProfileAnalytics);


export default router;
