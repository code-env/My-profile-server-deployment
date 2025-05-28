import express from 'express';
import {
    createTask,
    getTaskById,
    getUserTasks,
    updateTask,
    deleteTask,
    addSubTask,
    updateSubTask,
    deleteSubTask,
    addComment,
    likeComment,
    unlikeComment,
    addAttachment,
    removeAttachment,
    likeTask
} from '../controllers/task.controller';
import { authenticateToken } from '../middleware/authMiddleware';

const router = express.Router();

// Task routes
router.post('/', authenticateToken, createTask);
router.get('/:id', authenticateToken, getTaskById);
router.get('/', authenticateToken, getUserTasks);
router.put('/:id', authenticateToken, updateTask);
router.delete('/:id', authenticateToken, deleteTask);

// Subtask routes
router.post('/:id/subtasks', authenticateToken, addSubTask);
router.put('/:id/subtasks/:subTaskIndex', authenticateToken, updateSubTask);
router.delete('/:id/subtasks/:subTaskIndex', authenticateToken, deleteSubTask);

// Comment routes
router.post('/:id/comments', authenticateToken, addComment);
router.post('/:id/comments/:commentIndex/like', authenticateToken, likeComment);
router.delete('/:id/comments/:commentIndex/like', authenticateToken, unlikeComment);

// Like routes
router.post('/:id/like', authenticateToken, likeTask);

// Attachment routes
router.post('/:id/attachments', authenticateToken, addAttachment);
router.delete('/:id/attachments/:attachmentIndex', authenticateToken, removeAttachment);

export default router;