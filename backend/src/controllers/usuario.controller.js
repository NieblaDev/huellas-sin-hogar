import * as usuarioService from '../services/usuario.service.js';

export const listarUsuarios = async (req, res) => {
  try {
    const data = await usuarioService.listarUsuarios();
    res.json(data);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || 'Error al obtener los perfiles de usuario' });
  }
};

export const crearUsuario = async (req, res) => {
  try {
    const ip = req.ip || req.connection?.remoteAddress;
    const resultado = await usuarioService.crearUsuario(req.body, req.user, ip);
    res.status(201).json(resultado);
  } catch (error) {
    res.status(error.statusCode || 400).json({ error: error.message || 'Error al crear el perfil' });
  }
};

export const eliminarUsuario = async (req, res) => {
  try {
    const ip = req.ip || req.connection?.remoteAddress;
    const resultado = await usuarioService.eliminarUsuario(req.params.email, req.user, ip);
    res.json(resultado);
  } catch (error) {
    res.status(error.statusCode || 400).json({ error: error.message || 'Error al eliminar el perfil' });
  }
};
