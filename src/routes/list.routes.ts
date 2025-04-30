import express from 'express';
import {
  createList,
  getUserLists,
  updateList,
  deleteList,
  addListItem,
  updateListItem,
  deleteListItem,
  toggleItemCompletion,
  addListComment,
  likeList,
  unlikeList,
  getListById,
} from '../controllers/list.controller';

const router = express.Router();

// List CRUD routes
router.post('/', createList);
router.get('/', getUserLists);
router.get('/:id', getListById);
router.put('/:id', updateList);
router.delete('/:id', deleteList);

// List item routes
router.post('/:id/items', addListItem);
router.put('/:id/items/:itemIndex', updateListItem);
router.delete('/:id/items/:itemIndex', deleteListItem);
router.patch('/:id/items/:itemIndex/toggle', toggleItemCompletion);

// List interaction routes
router.post('/:id/comments', addListComment);
router.post('/:id/like', likeList);
router.delete('/:id/like', unlikeList);

export default router;