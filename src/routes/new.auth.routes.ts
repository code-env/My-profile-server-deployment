import express from 'express';
import {
  googleConsent,
  googleCallback,
  facebookConsent,
  facebookCallback,
} from '../controllers/new.auth.controllers';

const router = express.Router();


router.get('/google', googleConsent);
router.get('/google/callback', googleCallback);


router.get('/auth/facebook', facebookConsent);
router.get('/auth/facebook/callback', facebookCallback);

export default router;