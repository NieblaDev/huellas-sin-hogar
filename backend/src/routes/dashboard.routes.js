import { Router } from 'express';
import { getMetrics } from '../controllers/dashboard.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = Router();

// Requisito 2: Consulta de métricas para personal autenticado con restricción según rol
router.get('/metrics', authenticateToken, getMetrics);

export default router;
