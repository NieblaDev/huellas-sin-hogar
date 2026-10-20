import * as saludService from '../services/salud.service.js';

export const registrarVacuna = async (req, res) => {
  try {
    const ip = req.ip || req.connection?.remoteAddress;
    const result = await saludService.registrarVacuna(req.body, req.user, ip);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const registrarAtencion = async (req, res) => {
  try {
    const ip = req.ip || req.connection?.remoteAddress;
    const result = await saludService.registrarAtencionClinica(req.body, req.user, ip);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const registrarCuarentena = async (req, res) => {
  try {
    const ip = req.ip || req.connection?.remoteAddress;
    const result = await saludService.registrarCuarentena(req.body, req.user, ip);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getHistorialAnimal = async (req, res) => {
  try {
    const { animalId } = req.params;
    const historial = await saludService.obtenerHistorialAnimal(animalId);
    res.json(historial);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
};

export const getAlertasSanitarias = async (req, res) => {
  try {
    const alertas = await saludService.obtenerAlertasSanitarias();
    res.json(alertas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};