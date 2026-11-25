import { asyncHandler } from '../middlewares/error.middleware.js';
import * as insumoService from '../services/insumo.service.js';

export const getInsumos = asyncHandler(async (req, res) => {
  const data = await insumoService.getInsumos(req.user, req.query);
  res.json(data);
});

export const getInsumoById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const data = await insumoService.getInsumoById(id, req.user);
  res.json(data);
});

export const createInsumo = asyncHandler(async (req, res) => {
  const ip = req.ip;
  const nuevo = await insumoService.createInsumo(req.body, req.user, ip);
  res.status(201).json(nuevo);
});

export const updateInsumo = asyncHandler(async (req, res) => {
  const ip = req.ip;
  const { id } = req.params;
  const actualizado = await insumoService.updateInsumo(id, req.body, req.user, ip);
  res.json(actualizado);
});

export const deleteInsumo = asyncHandler(async (req, res) => {
  const ip = req.ip;
  const { id } = req.params;
  await insumoService.deleteInsumo(id, req.user, ip);
  res.json({ message: 'Insumo dado de baja correctamente' });
});

export const registrarMovimiento = asyncHandler(async (req, res) => {
  const ip = req.ip;
  const { id } = req.params;
  const resultado = await insumoService.registrarMovimiento(id, req.body, req.user, ip);
  res.status(201).json(resultado);
});

export const getMovimientosInsumo = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const movimientos = await insumoService.getMovimientosInsumo(id, req.user);
  res.json(movimientos);
});

export const getAlertasInventario = asyncHandler(async (req, res) => {
  const alertas = await insumoService.getAlertasInventario(req.user);
  res.json(alertas);
});
