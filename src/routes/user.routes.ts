import express from 'express';
import { SearchController } from '../controllers/search.controller';
import { ChatUserControllers } from '../controllers/user.controller';


const router = express.Router();
router.get('/', ChatUserControllers.GetAllUsers);
router.get('/:id', ChatUserControllers.GetUserById);

export default router;
