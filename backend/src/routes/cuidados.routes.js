import { Router } from 'express';
import { authenticateToken, requireRole } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import * as cuidadosCtrl from '../controllers/cuidados.controller.js';
import {
  crearIndicacionSchema,
  marcarTareaCompletadaSchema
} from '../schemas/cuidados.schema.js';

const router = Router();
router.use(authenticateToken);

// Panel de tareas del turno y consulta de historial (accesible para todo el staff y voluntarios)
router.get('/tareas', cuidadosCtrl.getTareasTurno);
router.get('/animal/:animalId', cuidadosCtrl.getHistorialAnimal);

// Registro de indicaciones de cuidado: SOLO personal con permisos médicos autorizados
router.post(
  '/indicaciones',
  requireRole('VETERINARIA', 'DIRECTORA'),
  validate(crearIndicacionSchema),
  cuidadosCtrl.crearIndicacion
);

// Cumplimiento en bitácora por voluntarios y personal de turno
router.post(
  '/completar',
  validate(marcarTareaCompletadaSchema),
  cuidadosCtrl.marcarCompletada
);

export default router;