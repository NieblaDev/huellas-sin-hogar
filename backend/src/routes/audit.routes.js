import { Router } from 'express';
import { getAuditorias } from '../controllers/audit.controller.js';
import { authenticateToken, requireRole } from '../middlewares/auth.middleware.js';

const router = Router();

// Requisito 3: Dirección consulta la bitácora histórica.
// RESTRICCIÓN ESTRICTA: Solo lectura (GET), acceso exclusivo para DIRECCION.
// No se implementan métodos POST, PUT ni DELETE para garantizar inmutabilidad.
router.get('/', authenticateToken, requireRole('DIRECCION'), getAuditorias);

export default router;
