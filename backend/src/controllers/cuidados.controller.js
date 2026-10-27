import * as cuidadosService from '../services/cuidados.service.js';

export const crearIndicacion = async (req, res) => {
  try {
    const ip = req.ip || req.connection?.remoteAddress;
    const indicacion = await cuidadosService.crearIndicacion(req.body, req.user, ip);
    res.status(201).json(indicacion);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getHistorialAnimal = async (req, res) => {
  try {
    const { animalId } = req.params;
    const historial = await cuidadosService.obtenerHistorialCuidadosAnimal(animalId);
    res.json(historial);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
};

export const getTareasTurno = async (req, res) => {
  try {
    const tareas = await cuidadosService.obtenerTareasTurno();
    res.json({ tareas });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const marcarCompletada = async (req, res) => {
  try {
    const ip = req.ip || req.connection?.remoteAddress;
    const resultado = await cuidadosService.marcarIndicacionCompletada(req.body, req.user, ip);
    res.status(201).json(resultado);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};