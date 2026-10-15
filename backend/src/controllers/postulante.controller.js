import * as postulanteService from '../services/postulante.service.js';

export const getPostulantes = async (req, res) => {
  try {
    const data = await postulanteService.getPostulantes();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createPostulante = async (req, res) => {
  try {
    const ip = req.ip || req.connection?.remoteAddress;
    const nuevo = await postulanteService.createPostulante(req.body, req.user, ip);
    res.status(201).json(nuevo);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const updatePostulante = async (req, res) => {
  try {
    const ip = req.ip || req.connection?.remoteAddress;
    const { id } = req.params;
    const actualizado = await postulanteService.updatePostulante(id, req.body, req.user, ip);
    res.json(actualizado);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const deletePostulante = async (req, res) => {
  try {
    const ip = req.ip || req.connection?.remoteAddress;
    const { id } = req.params;
    await postulanteService.deletePostulante(id, req.user, ip);
    res.json({ message: 'Postulante dado de baja correctamente' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
