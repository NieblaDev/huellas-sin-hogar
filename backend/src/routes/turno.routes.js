import { Router } from 'express';
import {
  getTurnos,
  getMatrizTurnos,
  createTurno,
  updateTurno,
  deleteTurno,
  confirmarPlanificacion,
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
router.get('/', getTurnos);
router.get('/matriz', getMatrizTurnos);
router.get('/alertas-descubiertos', getAlertasDescubiertos);
router.get('/directorio', getDirectorioVoluntarios);

// Gestión y planificación por parte del Coordinador
router.post('/', validate(crearTurnoSchema), createTurno);
router.put('/:id', validate(actualizarTurnoSchema), updateTurno);
router.delete('/:id', deleteTurno);
router.post('/confirmar-planificacion', confirmarPlanificacion);

// Gestión individual de inscripciones a turnos
router.post('/:id/inscribirse', validate(inscribirTurnoSchema), inscribirVoluntario);
router.delete('/:id/desinscribirse', desinscribirVoluntario);

// Gestión de permutas aprobadas por ambas partes
router.post('/permutas', validate(solicitarPermutaSchema), solicitarPermuta);
router.get('/permutas', getPermutas);
router.put('/permutas/:id/responder', validate(responderPermutaSchema), responderPermuta);

// Bitácora de turnos habilitada con inscripción previa obligatoria
router.post('/:id/bitacora', validate(registrarBitacoraSchema), registrarBitacora);
router.get('/:id/bitacoras', getBitacorasTurno);

export default router;
