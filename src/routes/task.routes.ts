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
} from '../controllers/task.controller';

const router = express.Router();

// Task CRUD routes
router.post('/', createTask);
router.get('/', getUserTasks);
router.get('/:id', getTaskById);
router.put('/:id', updateTask);
router.delete('/:id', deleteTask);

// Subtask routes
router.post('/:id/subtasks', addSubTask);
router.put('/:id/subtasks/:subTaskIndex', updateSubTask);
router.delete('/:id/subtasks/:subTaskIndex', deleteSubTask);

// Comment routes
router.post('/:id/comments', addComment);
router.post('/:id/comments/:commentIndex/like', likeComment);
router.delete('/:id/comments/:commentIndex/like', unlikeComment);

// Attachment routes
router.post('/:id/attachments', addAttachment);
router.delete('/:id/attachments/:attachmentIndex', removeAttachment);

export default router;