import express from 'express';
import { RelationshipTypeController } from '../controllers/relationshipType.controller';

const router = express.Router();

// Create
router.post('/', RelationshipTypeController.create);
router.post('/bulk', RelationshipTypeController.bulkCreate);

// Read
router.get('/', RelationshipTypeController.list);
router.get('/categories', RelationshipTypeController.listCategories);
router.get('/:id', RelationshipTypeController.get);

// Update
router.patch('/:id', RelationshipTypeController.update);
router.put('/:id', RelationshipTypeController.update);

// Delete
router.delete('/delete/bulk', RelationshipTypeController.bulkDelete);
router.delete('/:id', RelationshipTypeController.delete);
router.delete('/delete/all', RelationshipTypeController.deleteAll);

export default router;