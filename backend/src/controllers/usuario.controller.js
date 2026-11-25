import { asyncHandler } from '../middlewares/error.middleware.js';
import * as usuarioService from '../services/usuario.service.js';

export const listarUsuarios = asyncHandler(async (req, res) => {
  const data = await usuarioService.listarUsuarios();
  res.json(data);
});

export const crearUsuario = asyncHandler(async (req, res) => {
  const ip = req.ip;
  const resultado = await usuarioService.crearUsuario(req.body, req.user, ip);
  res.status(201).json(resultado);
});

export const actualizarSexoUsuario = asyncHandler(async (req, res) => {
  const ip = req.ip;
  const resultado = await usuarioService.actualizarSexoUsuario(req.params.email, req.body.sexo, req.user, ip);
  res.json(resultado);
});

export const eliminarUsuario = asyncHandler(async (req, res) => {
  const ip = req.ip;
  const resultado = await usuarioService.eliminarUsuario(req.params.email, req.user, ip);
  res.json(resultado);
});
