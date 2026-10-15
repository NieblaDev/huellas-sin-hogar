import * as auditService from '../services/audit.service.js';

export const getAuditorias = async (req, res) => {
  try {
    const data = await auditService.getAuditorias(req.query);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Error al consultar la bitácora de auditoría' });
  }
};
