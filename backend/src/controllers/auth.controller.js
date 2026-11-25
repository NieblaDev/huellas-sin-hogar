import { asyncHandler } from '../middlewares/error.middleware.js';
import * as authService from '../services/auth.service.js';

export const obtenerSesion = (req, res) => {
  res.set('Cache-Control', 'no-store').json({ user: authService.serializarSesion(req.user) });
};

export const login = asyncHandler(async (req, res) => {
  const data = await authService.loginUser(req.body);
  res.json(data);
});
