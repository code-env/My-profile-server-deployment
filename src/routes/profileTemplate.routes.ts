import express from 'express';
import { protect } from '../middleware/auth.middleware';
import {
  createTemplate,
  getTemplates,
  getTemplateById,
  updateTemplate,
  deleteTemplate,
} from '../controllers/profileTemplate.controller';

const router = express.Router();

router.route('/')
  .post(protect, createTemplate)
  .get(protect, getTemplates);

router.route('/:id')
  .get(protect, getTemplateById)
  .put(protect, updateTemplate)
  .delete(protect, deleteTemplate);

export default router;
