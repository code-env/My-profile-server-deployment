import express from 'express';
import {
  getItems,
  addItem,
  updateItem,
  deleteItem,
  getCategories,
  createCategory,
  createSubcategory,
  getItemById,
  getUserVault,
  getSubcategories,
  clearAllVaultItems,
  moveSubcategory,
  getNestedSubcategories,
  getItemsBySubcategory,
  getItemsByCategory,
  deleteSubcategory
} from '../controllers/vault.controller';
import { authenticateToken } from '../middleware/authMiddleware';

const router = express.Router();

// Vault routes
router.get('/', authenticateToken, getUserVault);

// Category routes
router.get('/categories', authenticateToken, getCategories);
router.post('/categories', authenticateToken, createCategory);

// Subcategory routes
router.get('/subcategories', authenticateToken, getSubcategories);
router.post('/subcategories', authenticateToken, createSubcategory);
router.get('/subcategories/nested', authenticateToken, getNestedSubcategories);
router.post('/subcategories/move', authenticateToken, moveSubcategory);
router.delete('/subcategories', authenticateToken, deleteSubcategory);

// Item routes
router.get('/items', authenticateToken, getItems); // Get all items with filters
router.get('/items/:itemId', authenticateToken, getItemById);
router.post('/items', authenticateToken, addItem);
router.put('/items/:itemId', authenticateToken, updateItem);
router.delete('/items/:itemId', authenticateToken, deleteItem);

// Category/Subcategory specific item routes
router.get('/categories/:categoryId/items', authenticateToken, getItemsByCategory); // Get items by category
router.get('/subcategories/:subcategoryId/items', authenticateToken, getItemsBySubcategory); // Get items by subcategory

// Clear all vault items
router.delete('/clear', authenticateToken, clearAllVaultItems);

export default router; 