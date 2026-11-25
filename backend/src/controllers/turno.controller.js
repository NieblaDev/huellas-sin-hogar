import { asyncHandler } from '../middlewares/error.middleware.js';
import * as turnoService from '../services/turno.service.js';

export const getTurnos = asyncHandler(async (req, res) => {
  const data = await turnoService.getTurnos(req.query);
  res.json(data);
});

export const getMatrizTurnos = asyncHandler(async (req, res) => {
  const matriz = await turnoService.getMatrizTurnos(req.query.semana);
  res.json(matriz);
});

export const createTurno = asyncHandler(async (req, res) => {
  const ip = req.ip;
  const nuevo = await turnoService.createTurno(req.body, req.user, ip);
  res.status(201).json(nuevo);
});

export const updateTurno = asyncHandler(async (req, res) => {
  const ip = req.ip;
  const { id } = req.params;
  const actualizado = await turnoService.updateTurno(id, req.body, req.user, ip);
  res.json(actualizado);
});

export const deleteTurno = asyncHandler(async (req, res) => {
  const ip = req.ip;
  const { id } = req.params;
  const resultado = await turnoService.deleteTurno(id, req.user, ip);
  res.json(resultado);
});

export const confirmarPlanificacion = asyncHandler(async (req, res) => {
  const ip = req.ip;
  const resultado = await turnoService.confirmarPlanificacionSemanal(req.user, ip, req.body?.semana);
  res.json(resultado);
});

export const limpiarMatrizSemanal = asyncHandler(async (req, res) => {
  const resultado = await turnoService.limpiarMatrizSemanal(req.body?.semana, req.user, req.ip);
  res.json(resultado);
});

export const inscribirVoluntario = asyncHandler(async (req, res) => {
  const ip = req.ip;
  const { id } = req.params;
  const inscripcion = await turnoService.inscribirVoluntario(id, req.user, req.body, ip);
  res.status(201).json(inscripcion);
});

export const desinscribirVoluntario = asyncHandler(async (req, res) => {
  const ip = req.ip;
  const { id } = req.params;
  const { usuarioId } = req.query;
  const resultado = await turnoService.desinscribirVoluntario(id, req.user, usuarioId, ip);
  res.json(resultado);
});

export const solicitarPermuta = asyncHandler(async (req, res) => {
  const ip = req.ip;
  const permuta = await turnoService.solicitarPermuta(req.body, req.user, ip);
  res.status(201).json(permuta);
});

export const getPermutas = asyncHandler(async (req, res) => {
  const permutas = await turnoService.getPermutas(req.user);
  res.json(permutas);
});

export const responderPermuta = asyncHandler(async (req, res) => {
  const ip = req.ip;
  const { id } = req.params;
  const { accion, observacion } = req.body;
  const resultado = await turnoService.responderPermuta(id, accion, observacion, req.user, ip);
  res.json(resultado);
});

export const registrarBitacora = asyncHandler(async (req, res) => {
  const ip = req.ip;
  const { id } = req.params;
  const bitacora = await turnoService.registrarBitacora(id, req.body, req.user, ip);
  res.status(201).json(bitacora);
});

export const getBitacorasTurno = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const bitacoras = await turnoService.getBitacorasTurno(id);
  res.json(bitacoras);
});

export const getAlertasDescubiertos = asyncHandler(async (req, res) => {
  const alertas = await turnoService.getTurnosDescubiertos();
  res.json(alertas);
});

export const getDirectorioVoluntarios = asyncHandler(async (req, res) => {
  const directorio = await turnoService.getDirectorioVoluntarios();
  res.json(directorio);
});
