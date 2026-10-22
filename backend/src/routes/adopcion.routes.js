import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { requireAdopcionStaff } from '../middlewares/adopcionStaff.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { editarSolicitudSchema, eliminarSolicitudSchema, crearSolicitudSchema, antecedentesQuerySchema, listarSolicitudesSchema, solicitudIdSchema } from '../schemas/adopcion.schema.js';
import * as controller from '../controllers/adopcion.controller.js';

const router = Router();
router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
router.use(authenticateToken, requireAdopcionStaff);
router.get('/antecedentes', validate(antecedentesQuerySchema, 'query'), controller.obtenerAntecedentes);
router.get('/animales-disponibles', controller.listarAnimalesDisponibles);
router.get('/solicitudes', validate(listarSolicitudesSchema, 'query'), controller.listarSolicitudes);
router.post('/solicitudes', validate(crearSolicitudSchema), controller.crearSolicitud);
router.get('/solicitudes/:id', validate(solicitudIdSchema, 'params'), controller.obtenerSolicitud);

router.patch('/solicitudes/:id', validate(solicitudIdSchema, 'params'), validate(editarSolicitudSchema), controller.editarSolicitud);
router.delete('/solicitudes/:id', validate(solicitudIdSchema, 'params'), validate(eliminarSolicitudSchema), controller.eliminarSolicitud);

export default router;
