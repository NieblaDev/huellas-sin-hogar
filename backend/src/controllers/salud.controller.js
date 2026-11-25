import { asyncHandler } from '../middlewares/error.middleware.js';
import * as saludService from '../services/salud.service.js';

export const registrarVacuna = asyncHandler(async (req, res) => {
  const ip = req.ip;
  const result = await saludService.registrarVacuna(req.body, req.user, ip);
  res.status(201).json(result);
});

export const registrarAtencion = asyncHandler(async (req, res) => {
  const ip = req.ip;
  const result = await saludService.registrarAtencionClinica(req.body, req.user, ip);
  res.status(201).json(result);
});

export const registrarCuarentena = asyncHandler(async (req, res) => {
  const ip = req.ip;
  const result = await saludService.registrarCuarentena(req.body, req.user, ip);
  res.status(201).json(result);
});

export const getHistorialAnimal = asyncHandler(async (req, res) => {
  const { animalId } = req.params;
  const historial = await saludService.obtenerHistorialAnimal(animalId);
  res.json(historial);
});

export const getAlertasSanitarias = asyncHandler(async (req, res) => {
  const alertas = await saludService.obtenerAlertasSanitarias();
  res.json(alertas);
});