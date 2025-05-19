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
  assignItemToProfile,
  addParticipant,
  removeParticipant,
  addAttachmentToItem,
  removeAttachmentFromItem,
  addSubTask,
  removeSubTask,
  duplicateList,
  checkAllItems,
  uncheckAllItems,
  shareList,
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
router.put('/:id/items/:itemId', updateListItem);
router.delete('/:id/items/:itemId', deleteListItem);
router.patch('/:id/items/:itemId/toggle', toggleItemCompletion);

// Advanced item routes
router.patch('/:id/items/:itemId/assign', assignItemToProfile);
router.patch('/:id/items/:itemId/attachments', addAttachmentToItem);
router.delete('/:id/items/:itemId/attachments/:attachmentIndex', removeAttachmentFromItem);
router.patch('/:id/items/:itemId/subtasks', addSubTask);
router.delete('/:id/items/:itemId/subtasks/:subTaskIndex', removeSubTask);

// List participant and sharing routes
router.patch('/:id/participants', addParticipant);
router.delete('/:id/participants', removeParticipant);
router.post('/:id/share', shareList);

// Bulk actions
router.post('/:id/duplicate', duplicateList);
router.patch('/:id/check-all', checkAllItems);
router.patch('/:id/uncheck-all', uncheckAllItems);

// List interaction routes
router.post('/:id/comments', addListComment);
router.post('/:id/like', likeList);
router.delete('/:id/like', unlikeList);

export default router;