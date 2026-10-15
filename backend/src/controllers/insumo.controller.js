import * as insumoService from '../services/insumo.service.js';

export const getInsumos = async (req, res) => {
  try {
    const data = await insumoService.getInsumos();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createInsumo = async (req, res) => {
  try {
    const ip = req.ip || req.connection?.remoteAddress;
    const nuevo = await insumoService.createInsumo(req.body, req.user, ip);
    res.status(201).json(nuevo);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const updateInsumo = async (req, res) => {
  try {
    const ip = req.ip || req.connection?.remoteAddress;
    const { id } = req.params;
    const actualizado = await insumoService.updateInsumo(id, req.body, req.user, ip);
    res.json(actualizado);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteInsumo = async (req, res) => {
  try {
    const ip = req.ip || req.connection?.remoteAddress;
    const { id } = req.params;
    await insumoService.deleteInsumo(id, req.user, ip);
    res.json({ message: 'Insumo dado de baja correctamente' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
