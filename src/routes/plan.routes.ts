import express from 'express';
import {
  createPlan,
  getPlanById,
  updatePlan,
  deletePlan,
  listPlans,
  addSubTask,
  toggleSubTask,
  addAgendaItem,
  confirmAppointment,
  registerForEvent,
  addComment,
  addAttachment,
  likePlan,
} from '../controllers/plans.controller';

const router = express.Router();

// Base routes
router.post('/:planType', createPlan);
router.get('/:id', getPlanById);
router.put('/:id', updatePlan);
router.delete('/:id', deletePlan);
router.get('/', listPlans);

// Type-specific routes
router.post('/tasks/:taskId/subtasks', addSubTask);
router.patch('/tasks/:taskId/subtasks/:subTaskId/toggle', toggleSubTask);
router.post('/meetings/:meetingId/agenda', addAgendaItem);
router.post('/appointments/:appointmentId/confirm', confirmAppointment);
router.post('/events/:eventId/register', registerForEvent);

// Common features
router.post('/:planId/comments', addComment);
router.post('/:planId/attachments', addAttachment);
router.post('/:planId/likes', likePlan);

// Bulk operations
// router.patch('/bulk', bulkUpdatePlans);
// router.delete('/bulk', bulkDeletePlans);

export default router;