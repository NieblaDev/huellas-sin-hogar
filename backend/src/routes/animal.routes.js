import { idParamSchema } from '../schemas/request.schema.js';
import { alertasAnimalSchema, reporteAnimalSchema, listarAnimalesSchema, formatoFichaSchema } from '../schemas/animal.schema.js';
import { Router } from 'express';
import {
  getAnimals,
  getAnimalById,
  createAnimal,
  updateAnimal,
  deleteAnimal,
  getNotifications,
  exportAnimalPdf,
  exportConsolidatedCsv
} from '../controllers/animal.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { authenticateToken, requireRole } from '../middlewares/auth.middleware.js';
import { createAnimalSchema, updateAnimalSchema } from '../schemas/animal.schema.js';
import { uploadSingle } from '../middlewares/upload.middleware.js';

const router = Router();

// Roles de voluntariado y personal del refugio habilitados para registro y consulta
const ROLES_INGRESO_Y_CONSULTA = [
  'DIRECCION',
  'PERSONAL_VETERINARIO',
  'PERSONAL_ADOPCIONES',
  'VOLUNTARIO_AVANZADO',
  'VOLUNTARIO_NOVATO'
];

// Roles de personal del refugio y Dirección habilitados para exportar Ficha del Animal PDF
const ROLES_EXPORTAR_PDF = ['DIRECCION', 'PERSONAL_VETERINARIO', 'PERSONAL_ADOPCIONES'];

// Bandeja de notificaciones internas para el personal del refugio
router.get('/notificaciones', authenticateToken, requireRole(...ROLES_INGRESO_Y_CONSULTA), validate(alertasAnimalSchema, 'query'), getNotifications);

// Exportación de reporte consolidado y balance general en CSV/PDF — EXCLUSIVO DIRECCION
router.get('/reportes/export-csv', authenticateToken, requireRole('DIRECCION'), validate(reporteAnimalSchema, 'query'), exportConsolidatedCsv);

// Catálogo general y Registro de ingreso de animales y creación de Ficha del Animal
router.get('/', authenticateToken, validate(listarAnimalesSchema, 'query'), getAnimals);
router.post(
  '/',
  authenticateToken,
  requireRole(...ROLES_INGRESO_Y_CONSULTA),
  uploadSingle('foto'),
  validate(createAnimalSchema, 'body'),
  createAnimal
);

// Exportación de Ficha del Animal en PDF/CSV — personal del refugio y Dirección
router.get('/:id/export-pdf', authenticateToken, requireRole(...ROLES_EXPORTAR_PDF), validate(idParamSchema, 'params'), validate(formatoFichaSchema, 'query'), exportAnimalPdf);

// Consulta de Ficha del Animal, edición (PUT / PATCH con soporte de foto Multer) y baja lógica
router.get('/:id', authenticateToken, validate(idParamSchema, 'params'), getAnimalById);
router.put(
  '/:id',
  authenticateToken,
  requireRole(...ROLES_INGRESO_Y_CONSULTA),
  validate(idParamSchema, 'params'),
  uploadSingle('foto'),
  validate(updateAnimalSchema, 'body'),
  updateAnimal
);
router.patch(
  '/:id',
  authenticateToken,
  requireRole(...ROLES_INGRESO_Y_CONSULTA),
  validate(idParamSchema, 'params'),
  uploadSingle('foto'),
  validate(updateAnimalSchema, 'body'),
  updateAnimal
);
router.delete('/:id', authenticateToken, validate(idParamSchema, 'params'), deleteAnimal);

export default router;