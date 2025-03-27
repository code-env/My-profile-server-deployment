import express from 'express';
import { UserControllers } from '../controllers/user.controller';


const router = express.Router();
router.get('/', UserControllers.GetAllUsers);
router.delete('/delete/:id', UserControllers.DeleteUserById);
router.post('/generate-username', UserControllers.GenerateUsername);
router.get('/:id', UserControllers.GetUserById);

export default router;
