import { sinParametrosSchema, idParamSchema } from '../schemas/request.schema.js';
import { listarInsumosSchema } from '../schemas/insumo.schema.js';
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

const router = Router();

// Todas las rutas requieren token y rol autorizado para inventario (Dirección, personal de adopciones, personal veterinario y voluntariado avanzado)
router.use(authenticateToken);
router.use(requireRole('DIRECCION', 'PERSONAL_VETERINARIO', 'PERSONAL_ADOPCIONES', 'VOLUNTARIO_AVANZADO'));

router.get('/', validate(listarInsumosSchema, 'query'), getInsumos);
router.get('/alertas', validate(sinParametrosSchema, 'query'), getAlertasInventario);
router.get('/:id', validate(idParamSchema, 'params'), getInsumoById);
router.post('/', validate(crearInsumoSchema), createInsumo);
router.put('/:id', validate(idParamSchema, 'params'), validate(actualizarInsumoSchema), updateInsumo);
router.delete('/:id', validate(idParamSchema, 'params'), deleteInsumo);

// Registro clasificado de movimientos (entradas por donaciones/compras y salidas por consumo/tratamientos)
router.post('/:id/movimientos', validate(idParamSchema, 'params'), validate(registrarMovimientoSchema), registrarMovimiento);
router.get('/:id/movimientos', validate(idParamSchema, 'params'), getMovimientosInsumo);

export default router;
