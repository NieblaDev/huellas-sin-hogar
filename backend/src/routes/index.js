import { Router } from 'express';
import authRoutes from './auth.routes.js';
import animalRoutes from './animal.routes.js';

const router = Router();
router.use('/auth', authRoutes);
router.use('/animals', animalRoutes);
export default router;