import { asyncHandler } from '../middlewares/error.middleware.js';
import { actualizarEtapa } from '../services/adopcionEtapa.service.js';

export const registrarEtapa = asyncHandler(async (req, res) => {
  res.json(await actualizarEtapa(req.params.id, req.body, req.adopcionStaff, req.ip));
});
