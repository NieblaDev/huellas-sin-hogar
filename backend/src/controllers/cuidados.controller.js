import { asyncHandler } from '../middlewares/error.middleware.js';
import * as cuidadosService from '../services/cuidados.service.js';

export const crearIndicacion = asyncHandler(async (req, res) => {
  const ip = req.ip;
  const indicacion = await cuidadosService.crearIndicacion(req.body, req.user, ip);
  res.status(201).json(indicacion);
});

export const getHistorialAnimal = asyncHandler(async (req, res) => {
  const { animalId } = req.params;
  const historial = await cuidadosService.obtenerHistorialCuidadosAnimal(animalId);
  res.json(historial);
});

export const getTareasTurno = asyncHandler(async (req, res) => {
  const tareas = await cuidadosService.obtenerTareasTurno();
  res.json({ tareas });
});

export const marcarCompletada = asyncHandler(async (req, res) => {
  const ip = req.ip;
  const resultado = await cuidadosService.marcarIndicacionCompletada(req.body, req.user, ip);
  res.status(201).json(resultado);
});