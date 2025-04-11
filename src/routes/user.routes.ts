import express from 'express';
import { UserControllers } from '../controllers/user.controller';
import { createProfile, getUserProfilesGrouped, updateProfileNew } from '../controllers/profile.controller';


const router = express.Router();
router.get('/', UserControllers.GetAllUsers);
router.delete('/delete/:id', UserControllers.DeleteUserById);
router.post('/generate-username', UserControllers.GenerateUsername);
router.get('/profiles/user-profile', getUserProfilesGrouped)
router.put('/profiles/:id', updateProfileNew)
router.post('/profile', createProfile);
router.get('/:id', UserControllers.GetUserById);

export default router;
