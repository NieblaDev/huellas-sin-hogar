import { sinParametrosSchema, idParamSchema } from '../schemas/request.schema.js';
import { listarTurnosSchema, semanaMatrizSchema, semanaTurnosSchema, limpiarSemanaSchema, desinscribirTurnoSchema } from '../schemas/turno.schema.js';
import { Router } from 'express';
import {
  getTurnos,
  getMatrizTurnos,
  createTurno,
  updateTurno,
  deleteTurno,
  confirmarPlanificacion,
  limpiarMatrizSemanal,
  inscribirVoluntario,
  desinscribirVoluntario,
  solicitarPermuta,
  getPermutas,
  responderPermuta,
  registrarBitacora,
  getBitacorasTurno,
  getAlertasDescubiertos,
  getDirectorioVoluntarios
} from '../controllers/turno.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  crearTurnoSchema,
  actualizarTurnoSchema,
  inscribirTurnoSchema,
  solicitarPermutaSchema,
  responderPermutaSchema,
  registrarBitacoraSchema
} from '../schemas/turno.schema.js';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// Consultas y visualización de matriz interactiva
router.get('/', validate(listarTurnosSchema, 'query'), getTurnos);
router.get('/matriz', validate(semanaMatrizSchema, 'query'), getMatrizTurnos);
router.get('/alertas-descubiertos', validate(sinParametrosSchema, 'query'), getAlertasDescubiertos);
router.get('/directorio', validate(sinParametrosSchema, 'query'), getDirectorioVoluntarios);

// Gestión y planificación a cargo de Dirección
router.post('/', validate(crearTurnoSchema), createTurno);
router.put('/:id', validate(idParamSchema, 'params'), validate(actualizarTurnoSchema), updateTurno);
router.delete('/:id', validate(idParamSchema, 'params'), deleteTurno);
router.post('/confirmar-planificacion', validate(semanaTurnosSchema), confirmarPlanificacion);
router.post('/matriz/limpiar', validate(limpiarSemanaSchema), limpiarMatrizSemanal);

// Gestión individual de inscripciones a turnos
router.post('/:id/inscribirse', validate(idParamSchema, 'params'), validate(inscribirTurnoSchema), inscribirVoluntario);
router.delete('/:id/desinscribirse', validate(idParamSchema, 'params'), validate(desinscribirTurnoSchema, 'query'), desinscribirVoluntario);

// Gestión de permutas aprobadas por ambas partes
router.post('/permutas', validate(solicitarPermutaSchema), solicitarPermuta);
router.get('/permutas', validate(sinParametrosSchema, 'query'), getPermutas);
router.put('/permutas/:id/responder', validate(idParamSchema, 'params'), validate(responderPermutaSchema), responderPermuta);

// Bitácora de turnos habilitada con inscripción previa obligatoria
router.post('/:id/bitacora', validate(idParamSchema, 'params'), validate(registrarBitacoraSchema), registrarBitacora);
router.get('/:id/bitacoras', validate(idParamSchema, 'params'), getBitacorasTurno);

export default router;
