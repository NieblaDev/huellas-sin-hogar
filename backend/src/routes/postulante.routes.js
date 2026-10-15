import { Router } from 'express';
import { getPostulantes, createPostulante, updatePostulante, deletePostulante } from '../controllers/postulante.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', authenticateToken, getPostulantes);
router.post('/', authenticateToken, createPostulante);
router.put('/:id', authenticateToken, updatePostulante);
router.delete('/:id', authenticateToken, deletePostulante);

export default router;
