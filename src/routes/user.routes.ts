import express from 'express';
import { ChatUserControllers } from '../controllers/user.controller';


const router = express.Router();
router.get('/', ChatUserControllers.GetAllUsers);
router.delete('/delete/:id', ChatUserControllers.DeleteUserById);
router.get('/:id', ChatUserControllers.GetUserById);

export default router;
