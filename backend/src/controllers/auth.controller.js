import * as authService from '../services/auth.service.js';

export const obtenerSesion = (req, res) => {
  res.set('Cache-Control', 'no-store').json({ user: authService.serializarSesion(req.user) });
};

export const login = async (req, res) => {
  try {
    const data = await authService.loginUser(req.body);
    res.json(data);
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
};
