import { actualizarEtapaSchema } from '../schemas/adopcionEtapa.schema.js';
import { registrarEtapa } from '../controllers/adopcionEtapa.controller.js';
import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { requireAdopcionStaff } from '../middlewares/adopcionStaff.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { editarSolicitudSchema, eliminarSolicitudSchema, crearSolicitudSchema, antecedentesQuerySchema, listarSolicitudesSchema, solicitudIdSchema } from '../schemas/adopcion.schema.js';
import * as controller from '../controllers/adopcion.controller.js';
import * as seguimientoController from '../controllers/seguimiento.controller.js';
import * as devolucionController from '../controllers/devolucion.controller.js';
import {
  listarSeguimientosSchema,
  seguimientoIdSchema,
  registrarSeguimientoSchema,
  reprogramarIntentoSchema,
  programarSeguimientoSchema,
  configurarLimiteIntentosSchema
} from '../schemas/seguimiento.schema.js';
import {
  registrarDevolucionSchema,
  devolucionIdSchema,
  listarDevolucionesSchema
} from '../schemas/devolucion.schema.js';

const router = Router();
router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
router.use(authenticateToken, requireAdopcionStaff);

// Solicitudes y antecedentes (RF1)
router.get('/antecedentes', validate(antecedentesQuerySchema, 'query'), controller.obtenerAntecedentes);
router.get('/animales-disponibles', controller.listarAnimalesDisponibles);
router.get('/solicitudes', validate(listarSolicitudesSchema, 'query'), controller.listarSolicitudes);
router.post('/solicitudes', validate(crearSolicitudSchema), controller.crearSolicitud);
router.get('/solicitudes/:id', validate(solicitudIdSchema, 'params'), controller.obtenerSolicitud);

router.patch('/solicitudes/:id', validate(solicitudIdSchema, 'params'), validate(editarSolicitudSchema), controller.editarSolicitud);
router.delete('/solicitudes/:id', validate(solicitudIdSchema, 'params'), validate(eliminarSolicitudSchema), controller.eliminarSolicitud);

router.post('/solicitudes/:id/etapas', validate(solicitudIdSchema, 'params'), validate(actualizarEtapaSchema), registrarEtapa);

// Seguimientos post-adopción (RF2)
router.get('/seguimientos', validate(listarSeguimientosSchema, 'query'), seguimientoController.listarSeguimientos);
router.get('/seguimientos/configuracion', seguimientoController.obtenerConfiguracion);
router.put('/seguimientos/configuracion', validate(configurarLimiteIntentosSchema), seguimientoController.actualizarConfiguracion);
router.get('/seguimientos/:id', validate(seguimientoIdSchema, 'params'), seguimientoController.obtenerSeguimiento);
router.post('/seguimientos', validate(programarSeguimientoSchema), seguimientoController.programarSeguimiento);
router.post('/seguimientos/:id/registrar', validate(seguimientoIdSchema, 'params'), validate(registrarSeguimientoSchema), seguimientoController.registrarSeguimiento);
router.put('/seguimientos/:id', validate(seguimientoIdSchema, 'params'), validate(registrarSeguimientoSchema), seguimientoController.registrarSeguimiento);
router.post('/seguimientos/:id/reprogramar', validate(seguimientoIdSchema, 'params'), validate(reprogramarIntentoSchema), seguimientoController.reprogramarSeguimiento);

// Devoluciones y reingreso (RF2)
router.get('/devoluciones', validate(listarDevolucionesSchema, 'query'), devolucionController.listarDevoluciones);
router.get('/devoluciones/:id', validate(devolucionIdSchema, 'params'), devolucionController.obtenerDevolucion);
router.post('/devoluciones', validate(registrarDevolucionSchema), devolucionController.registrarDevolucion);

export default router;
