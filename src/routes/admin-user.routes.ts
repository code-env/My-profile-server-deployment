/**
 * Admin User Management Routes
 * 
 * These routes provide comprehensive user management functionality for admins and super admins.
 * All routes require authentication and admin/superadmin roles.
 * 
 * Available endpoints:
 * - POST   /api/admin/users              - Create a new user
 * - GET    /api/admin/users              - Get all users with pagination and filtering
 * - GET    /api/admin/users/stats        - Get user statistics
 * - GET    /api/admin/users/search       - Search users
 * - GET    /api/admin/users/:userId      - Get specific user by ID
 * - PUT    /api/admin/users/:userId      - Update user
 * - DELETE /api/admin/users/:userId      - Delete user
 * - POST   /api/admin/users/:userId/ban  - Ban/unban user
 * - POST   /api/admin/users/:userId/lock - Lock/unlock user account
 * - POST   /api/admin/users/:userId/role - Change user role
 * - POST   /api/admin/users/:userId/verify - Force verify user email/phone
 * - POST   /api/admin/users/bulk-update  - Bulk update multiple users
 * 
 * Query Parameters for GET /api/admin/users:
 * - page: number (default: 1)
 * - limit: number (default: 20, max: 100)
 * - search: string (search in name, email, username, phone)
 * - role: string (filter by role)
 * - accountType: string (filter by account type)
 * - isEmailVerified: boolean
 * - isPhoneVerified: boolean
 * - status: 'active' | 'inactive' | 'banned'
 * - countryOfResidence: string
 * - dateJoinedFrom: ISO date string
 * - dateJoinedTo: ISO date string
 * - lastLoginFrom: ISO date string
 * - lastLoginTo: ISO date string
 * 
 * Example usage:
 * 
 * // Create a new user
 * POST /api/admin/users
 * {
 *   "email": "user@example.com",
 *   "password": "securePassword123",
 *   "fullName": "John Doe",
 *   "username": "johndoe",
 *   "firstName": "John",
 *   "lastName": "Doe",
 *   "accountType": "MYSELF",
 *   "accountCategory": "PRIMARY_ACCOUNT",
 *   "verificationMethod": "EMAIL",
 *   "role": "user",
 *   "isEmailVerified": true
 * }
 * 
 * // Get all users with pagination
 * GET /api/admin/users?page=1&limit=20
 * 
 * // Search users
 * GET /api/admin/users?search=john
 * 
 * // Filter by role and status
 * GET /api/admin/users?role=user&status=active
 * 
 * // Get user statistics
 * GET /api/admin/users/stats
 * 
 * // Search users
 * GET /api/admin/users/search?q=john&limit=10
 * 
 * // Ban a user
 * POST /api/admin/users/123/ban
 * {
 *   "banned": true,
 *   "reason": "Violation of terms"
 * }
 * 
 * // Change user role
 * POST /api/admin/users/123/role
 * {
 *   "role": "admin"
 * }
 * 
 * // Bulk update users
 * POST /api/admin/users/bulk-update
 * {
 *   "userIds": ["id1", "id2", "id3"],
 *   "updateData": {
 *     "isEmailVerified": true
 *   }
 * }
 */

import express from 'express';
import { AdminUserController } from '../controllers/admin-user.controller';
import { protect } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/roleMiddleware';

const router = express.Router();

// Apply authentication and role requirements to all routes
router.use(protect);
router.use(requireRole(['admin', 'superadmin']));

// User statistics (must come before :userId routes)
router.get('/stats', AdminUserController.getUserStats);

// Search users (must come before :userId routes)
router.get('/search', AdminUserController.searchUsers);

// Bulk operations (must come before :userId routes)
router.post('/bulk-update', AdminUserController.bulkUpdateUsers);

// Create and get all users
router.post('/', AdminUserController.createUser);
router.get('/', AdminUserController.getAllUsers);

// Individual user operations
router.get('/:userId', AdminUserController.getUserById);
router.put('/:userId', AdminUserController.updateUser);
router.delete('/:userId', AdminUserController.deleteUser);

// User status management
router.post('/:userId/ban', AdminUserController.toggleUserBan);
router.post('/:userId/lock', AdminUserController.toggleUserLock);
router.post('/:userId/role', AdminUserController.changeUserRole);
router.post('/:userId/verify', AdminUserController.forceVerifyUser);

export default router; 