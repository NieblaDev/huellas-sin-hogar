import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';

export const authenticateToken = async (req, res, next) => {
  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Inicia sesión para continuar.' });

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET || 'huellas_secret_key_2026');
  } catch {
    return res.status(403).json({ error: 'Tu sesión expiró o ya no es válida. Vuelve a iniciar sesión.' });
  }

  if (!Number.isInteger(payload?.id) || payload.id <= 0) {
    return res.status(403).json({ error: 'Tu sesión expiró o ya no es válida. Vuelve a iniciar sesión.' });
  }

  try {
    // No confiar en el rol ni en el estado guardados en el token:
    // un perfil desactivado pierde acceso de inmediato y los cambios de rol aplican al instante.
    const usuario = await prisma.usuario.findUnique({
      where: { id: payload.id },
      select: { id: true, email: true, nombre: true, rol: true, sexo: true, activo: true }
    });

    if (!usuario?.activo) {
      return res.status(403).json({ error: 'Perfil inactivo o inexistente' });
    }

    req.user = usuario;
    next();
  } catch {
    res.status(500).json({ error: 'No se pudo verificar la sesión' });
  }
};

/**
 * Middleware para validar uno o varios roles permitidos
 */
export const requireRole = (...rolesPermitidos) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Usuario no autenticado' });
  }

  if (!rolesPermitidos.includes(req.user.rol)) {
    return res.status(403).json({
      error: 'Tu perfil no tiene permisos para realizar esta acción.'
    });
  }

  next();
};
