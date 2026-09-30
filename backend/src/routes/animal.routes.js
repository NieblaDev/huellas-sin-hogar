import { Router } from 'express';
import { getAnimals, createAnimal, deleteAnimal } from '../controllers/animal.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { createAnimalSchema } from '../schemas/animal.schema.js';

const router = Router();

router.get('/', authenticateToken, getAnimals);
router.post('/', authenticateToken, validate(createAnimalSchema, 'body'), createAnimal);
router.delete('/:id', authenticateToken, deleteAnimal);

export default router;