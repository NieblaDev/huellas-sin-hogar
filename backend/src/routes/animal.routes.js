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
import { createAnimalSchema } from '../schemas/animal.schema.js';

const router = Router();

// Roles de voluntariado y personal del refugio habilitados para registro y consulta
const ROLES_INGRESO_Y_CONSULTA = [
  'DIRECTORA',
  'VETERINARIA',
  'ENCARGADA_ADOPCIONES',
  'VOLUNTARIO_AVANZADO',
  'VOLUNTARIO_NOVATO'
];

// Roles de Personal del Refugio y Directora habilitados para exportar Ficha Técnica PDF
const ROLES_EXPORTAR_PDF = ['DIRECTORA', 'VETERINARIA', 'ENCARGADA_ADOPCIONES'];

// Bandeja de notificaciones internas para el personal del refugio
router.get('/notificaciones', authenticateToken, requireRole(...ROLES_INGRESO_Y_CONSULTA), getNotifications);

// Requerimiento 2.2: Exportación de reporte consolidado y balance general en CSV — EXCLUSIVO DIRECTORA
router.get('/reportes/export-csv', authenticateToken, requireRole('DIRECTORA'), exportConsolidatedCsv);

// Catálogo general y Requerimiento 1: Registro de ingreso de animales y creación de ficha técnica
router.get('/', authenticateToken, getAnimals);
router.post(
  '/',
  authenticateToken,
  requireRole(...ROLES_INGRESO_Y_CONSULTA),
  validate(createAnimalSchema, 'body'),
  createAnimal
);

// Requerimiento 2.1: Exportación de Ficha Técnica Individual en PDF — Personal del Refugio y Directora
router.get('/:id/export-pdf', authenticateToken, requireRole(...ROLES_EXPORTAR_PDF), exportAnimalPdf);

// Consulta de Ficha Técnica Individual, actualización y baja lógica
router.get('/:id', authenticateToken, getAnimalById);
router.put('/:id', authenticateToken, updateAnimal);
router.delete('/:id', authenticateToken, deleteAnimal);

export default router;