import express from 'express';
import { AuthSocialController } from '../controllers/socials.auth.controllers';

const router = express.Router();


router.get('/google', AuthSocialController.googleConsent);

router.post('/google/callback', AuthSocialController.googleAuth);
router.get('/google/callbacks', AuthSocialController.googleAuth);



router.get('/facebook', AuthSocialController.facebookConsent);


router.get('/facebook/callback', AuthSocialController.facebookAuth);

export default router;

//clientid: 124684938199-e7ocs5m4npm1hm31i5e0j5sbqk9m62m9.apps.googleusercontent.com
//clientsecret: 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
