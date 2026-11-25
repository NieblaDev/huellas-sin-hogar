import { sinParametrosSchema, animalIdParamSchema } from '../schemas/request.schema.js';
import { Router } from 'express';
import { authenticateToken, requireRole } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import * as saludCtrl from '../controllers/salud.controller.js';
import {
  registrarVacunaSchema,
  registrarAtencionSchema,
  registrarCuarentenaSchema
} from '../schemas/salud.schema.js';

const router = Router();

// Todas las consultas requieren estar autenticado
router.use(authenticateToken);

// Consulta de alertas e historial accesible para el staff
router.get('/alertas', validate(sinParametrosSchema, 'query'), saludCtrl.getAlertasSanitarias);
router.get('/historial/:animalId', validate(animalIdParamSchema, 'params'), saludCtrl.getHistorialAnimal);

// Operaciones de registro médico: Exclusivas para PERSONAL_VETERINARIO y DIRECCION
router.post(
  '/vacunas',
  requireRole('PERSONAL_VETERINARIO', 'DIRECCION'),
  validate(registrarVacunaSchema),
  saludCtrl.registrarVacuna
);

router.post(
  '/atenciones',
  requireRole('PERSONAL_VETERINARIO', 'DIRECCION'),
  validate(registrarAtencionSchema),
  saludCtrl.registrarAtencion
);

router.post(
  '/cuarentenas',
  requireRole('PERSONAL_VETERINARIO', 'DIRECCION'),
  validate(registrarCuarentenaSchema),
  saludCtrl.registrarCuarentena
);

export default router;