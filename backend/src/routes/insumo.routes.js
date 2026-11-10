import { Router } from 'express';
import {
  getInsumos,
  getInsumoById,
  createInsumo,
  updateInsumo,
  deleteInsumo,
  registrarMovimiento,
  getMovimientosInsumo,
  getAlertasInventario
} from '../controllers/insumo.controller.js';
import { authenticateToken, requireRole } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { crearInsumoSchema, actualizarInsumoSchema, registrarMovimientoSchema } from '../schemas/insumo.schema.js';
import { ROLES_INVENTARIO } from '../services/insumo.service.js';

const router = Router();

// Todas las rutas requieren token y rol autorizado para inventario (Staff, Veterinaria y Voluntarios Avanzados)
router.use(authenticateToken);
router.use(requireRole(...ROLES_INVENTARIO));

router.get('/', getInsumos);
router.get('/alertas', getAlertasInventario);
router.get('/:id', getInsumoById);
router.post('/', validate(crearInsumoSchema), createInsumo);
router.put('/:id', validate(actualizarInsumoSchema), updateInsumo);
router.delete('/:id', deleteInsumo);

// Registro clasificado de movimientos (entradas por donaciones/compras y salidas por consumo/tratamientos)
router.post('/:id/movimientos', validate(registrarMovimientoSchema), registrarMovimiento);
router.get('/:id/movimientos', getMovimientosInsumo);

export default router;
