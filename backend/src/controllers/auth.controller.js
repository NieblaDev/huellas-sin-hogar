import * as authService from '../services/auth.service.js';

export const login = async (req, res) => {
  try {
    const data = await authService.loginUser(req.body);
    res.json(data);
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
};