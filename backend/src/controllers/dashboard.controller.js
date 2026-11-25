import { asyncHandler } from '../middlewares/error.middleware.js';
import * as dashboardService from '../services/dashboard.service.js';

export const getMetrics = asyncHandler(async (req, res) => {
  const data = await dashboardService.getDashboardMetrics(req.user);
  res.json(data);
});
