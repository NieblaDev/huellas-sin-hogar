import * as dashboardService from '../services/dashboard.service.js';

export const getMetrics = async (req, res) => {
  try {
    const data = await dashboardService.getDashboardMetrics(req.user);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Error al obtener métricas del panel' });
  }
};
