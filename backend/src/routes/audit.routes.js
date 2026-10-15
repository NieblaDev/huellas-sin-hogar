import { Router } from 'express';
import { getAuditorias } from '../controllers/audit.controller.js';
import { authenticateToken, requireRole } from '../middlewares/auth.middleware.js';

const router = Router();

// Requisito 3: La Directora consulta la bitácora histórica.
// RESTRICCIÓN ESTRICTA: Solo lectura (GET), acceso exclusivo para DIRECTORA.
// No se implementan métodos POST, PUT ni DELETE para garantizar inmutabilidad.
router.get('/', authenticateToken, requireRole('DIRECTORA'), getAuditorias);

export default router;
