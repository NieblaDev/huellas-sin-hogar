import { validate } from '../middlewares/validate.middleware.js';
import { sinParametrosSchema } from '../schemas/request.schema.js';
import { Router } from 'express';
import { getMetrics } from '../controllers/dashboard.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = Router();

// Requisito 2: Consulta de métricas para personal autenticado con restricción según rol
router.get('/metrics', authenticateToken, validate(sinParametrosSchema, 'query'), getMetrics);

export default router;
