import { Router } from 'express';
import {
  getCaniles,
  asignarCanil,
  solicitarTrasladoExterno,
  gestionarAprobacion,
  getTraslados
} from '../controllers/canil.controller.js';
import { authenticateToken, requireRole } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  asignarCanilSchema,
  trasladoExternoSchema,
  gestionAprobacionSchema
} from '../schemas/canil.schema.js';

const router = Router();

// Requisito 1: Cualquier miembro del staff autenticado puede ver caniles y asignar/reubicar
router.get('/', authenticateToken, getCaniles);
router.post('/asignar', authenticateToken, validate(asignarCanilSchema, 'body'), asignarCanil);

// Solicitud de traslado externo (Hogar Temporal o Protectora Aliada)
router.post('/traslados', authenticateToken, validate(trasladoExternoSchema, 'body'), solicitarTrasladoExterno);
router.get('/traslados', authenticateToken, getTraslados);

// Aprobación de traslado: RESTRICCIÓN ESTRICTA SOLO DIRECTORA
router.put('/traslados/:id/aprobacion', authenticateToken, requireRole('DIRECTORA'), validate(gestionAprobacionSchema, 'body'), gestionarAprobacion);

export default router;
