import { asyncHandler } from '../middlewares/error.middleware.js';
import * as auditService from '../services/audit.service.js';

export const getAuditorias = asyncHandler(async (req, res) => {
  const data = await auditService.getAuditorias(req.query);
  res.json(data);
});
