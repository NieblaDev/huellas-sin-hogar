import { asyncHandler } from '../middlewares/error.middleware.js';
import * as postulanteService from '../services/postulante.service.js';

export const getPostulantes = asyncHandler(async (req, res) => {
  const data = await postulanteService.getPostulantes();
  res.json(data);
});

export const createPostulante = asyncHandler(async (req, res) => {
  const ip = req.ip;
  const nuevo = await postulanteService.createPostulante(req.body, req.user, ip);
  res.status(201).json(nuevo);
});

export const updatePostulante = asyncHandler(async (req, res) => {
  const ip = req.ip;
  const { id } = req.params;
  const actualizado = await postulanteService.updatePostulante(id, req.body, req.user, ip);
  res.json(actualizado);
});

export const deletePostulante = asyncHandler(async (req, res) => {
  const ip = req.ip;
  const { id } = req.params;
  await postulanteService.deletePostulante(id, req.user, ip);
  res.json({ message: 'Postulante dado de baja correctamente' });
});
