import express from 'express';
import { UserControllers } from '../controllers/user.controller';
import { getUserProfilesGrouped, updateProfileNew } from '../controllers/profile.controller';


const router = express.Router();
router.get('/', UserControllers.GetAllUsers);
router.delete('/delete/:id', UserControllers.DeleteUserById);
router.post('/generate-username', UserControllers.GenerateUsername);
router.get('/profiles/user-profile', getUserProfilesGrouped)
router.put('/profile-update:/id', updateProfileNew)
router.get('/:id', UserControllers.GetUserById);

export default router;
