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
router.get('/alertas', saludCtrl.getAlertasSanitarias);
router.get('/historial/:animalId', saludCtrl.getHistorialAnimal);

// Operaciones de registro médico: Exclusivas para VETERINARIA y DIRECTORA
router.post(
  '/vacunas',
  requireRole('VETERINARIA', 'DIRECTORA'),
  validate(registrarVacunaSchema),
  saludCtrl.registrarVacuna
);

router.post(
  '/atenciones',
  requireRole('VETERINARIA', 'DIRECTORA'),
  validate(registrarAtencionSchema),
  saludCtrl.registrarAtencion
);

router.post(
  '/cuarentenas',
  requireRole('VETERINARIA', 'DIRECTORA'),
  validate(registrarCuarentenaSchema),
  saludCtrl.registrarCuarentena
);

export default router;