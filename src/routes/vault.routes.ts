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
  clearAllVaultItems
} from '../controllers/vault.controller';
import { authenticateToken } from '../middleware/authMiddleware';

const router = express.Router();

// Vault routes
router.get('/', authenticateToken, getUserVault);

// Item routes
router.get('/items', getItems);
router.get('/items/:itemId', getItemById);
router.post('/items', addItem);
router.put('/items/:itemId', updateItem);
router.delete('/items/:itemId', deleteItem);

// Category routes
router.get('/categories', getCategories);
router.post('/categories', createCategory);
router.post('/categories/:categoryName/subcategories', createSubcategory);
router.get('/subcategories', getSubcategories);

// Clear all vault items
router.delete('/clear', clearAllVaultItems);

export default router; 