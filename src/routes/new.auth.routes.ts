import express from 'express';
import {
  googleConsent,
  googleCallback,
  facebookConsent,
  facebookCallback,
  googleMobileCallback,
} from '../controllers/new.auth.controllers';

const router = express.Router();


router.get('/google', googleConsent);
router.get('/google/callback', googleCallback);
router.post('/google/mobile-callback', googleMobileCallback)


router.get('/facebook', facebookConsent);
router.get('/facebook/callback', facebookCallback);
router.post('/facebook/mobile-callback', googleMobileCallback)



export default router;