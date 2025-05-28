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

// User update routes
router.put('/update', authenticateToken, UserControllers.UpdateUserInfo);
router.put('/update-profile-image', authenticateToken, UserControllers.UpdateProfileImage);

// Admin update user by ID (protected)
router.put('/:id', authenticateToken, UserControllers.AdminUpdateUserById);

export default router;
