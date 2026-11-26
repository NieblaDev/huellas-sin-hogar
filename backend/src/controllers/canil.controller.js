import { asyncHandler } from '../middlewares/error.middleware.js';
import * as canilService from '../services/canil.service.js';

export const getCaniles = asyncHandler(async (req, res) => {
  const data = await canilService.getAllCaniles();
  res.json(data);
});

export const asignarCanil = asyncHandler(async (req, res) => {
  const ip = req.ip;
  const resultado = await canilService.asignarCanil(req.body, req.user, ip);
  res.json(resultado);
});

export const solicitarTrasladoExterno = asyncHandler(async (req, res) => {
  const ip = req.ip;
  const traslado = await canilService.solicitarTrasladoExterno(req.body, req.user, ip);
  res.status(201).json({
    message: 'Solicitud de traslado registrada con éxito. Requiere aprobación de Dirección.',
    traslado
  });
});

export const gestionarAprobacion = asyncHandler(async (req, res) => {
  const ip = req.ip;
  const { id } = req.params;
  const traslado = await canilService.gestionarAprobacionTraslado(id, req.body, req.user, ip);
  res.json({
    message: `Traslado ${traslado.estado.toLowerCase()} exitosamente`,
    traslado
  });
});

export const createCanil = asyncHandler(async (req, res) => {
  const ip = req.ip;
  const canil = await canilService.createCanil(req.body, req.user, ip);
  res.status(201).json({ message: 'Canil creado con éxito', canil });
});

export const actualizarSectorCanil = asyncHandler(async (req, res) => {
  const ip = req.ip;
  const { id } = req.params;
  const resultado = await canilService.actualizarSectorCanil(
    { canilId: id, sector: req.body.sector },
    req.user,
    ip
  );
  res.json(resultado);
});

export const deleteCanil = asyncHandler(async (req, res) => {
  const ip = req.ip;
  const { id } = req.params;
  const resultado = await canilService.deleteCanil({ canilId: id }, req.user, ip);
  res.json(resultado);
});

export const getTraslados = asyncHandler(async (req, res) => {
  const traslados = await canilService.getTraslados(req.query);
  res.json(traslados);
});

import { finalizarCuarentena } from '../services/cuarentena.service.js';

export const detalle = asyncHandler(async (req,res) => res.json(await canilService.getCanil(req.params.id)));
export const editar = asyncHandler(async (req,res) => res.json(await canilService.actualizarCanil(req.params.id, req.body, req.user, req.ip)));
export const finalizar = asyncHandler(async (req,res) => res.json(await finalizarCuarentena({ ...req.body, canilId: req.params.id, user: req.user, ip: req.ip })));
