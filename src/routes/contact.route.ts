import express from 'express';
import {
  createContact,
  getContactById,
  getUserContacts,
  updateContact,
  deleteContact,
  toggleFavorite,
  syncContacts,
  getRegisteredContacts,
  updateLastContacted,
  bulkUpdateCategories
} from '../controllers/contacts.controller';

const router = express.Router();

// Contact CRUD routes
router.post('/', createContact);
router.get('/', getUserContacts);
router.get('/:id', getContactById);
router.put('/:id', updateContact);
router.delete('/:id', deleteContact);

// Contact features routes
router.patch('/:id/favorite', toggleFavorite);
router.post('/sync', syncContacts);
router.get('/registered/list', getRegisteredContacts);
router.patch('/:id/last-contacted', updateLastContacted);
router.patch('/bulk-update/categories', bulkUpdateCategories);

export default router;