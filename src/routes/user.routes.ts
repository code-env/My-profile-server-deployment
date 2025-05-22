import express from 'express';
import { UserControllers } from '../controllers/user.controller';
import { authenticateToken } from '../middleware/authMiddleware';

const router = express.Router();

// Public routes
router.get('/', UserControllers.GetAllUsers);
router.get('/generate-username', UserControllers.GenerateUsername);

// Protected routes
router.get('/me', authenticateToken, UserControllers.GetCurrentUser);
router.get('/:id', UserControllers.GetUserById);
router.delete('/delete/:id', UserControllers.DeleteUserById);

export default router;
