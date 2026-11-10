import { actualizarEtapa } from '../services/adopcionEtapa.service.js';
import { AdopcionError } from '../services/adopcion.service.js';

export const registrarEtapa = async (req, res) => {
  try {
    res.json(await actualizarEtapa(req.params.id, req.body, req.adopcionStaff, req.ip));
  } catch (error) {
    if (error instanceof AdopcionError) return res.status(error.status).json({ error: error.message });
    console.error('Error al registrar etapa de adopción:', error.code || error.name);
    res.status(500).json({ error: 'No se pudo guardar la etapa. No se aplicaron cambios.' });
  }
};
