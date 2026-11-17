import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';

export const authenticateToken = async (req, res, next) => {
  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token requerido' });

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET || 'huellas_secret_key_2026');
  } catch {
    return res.status(403).json({ error: 'Token inválido o expirado' });
  }

  if (!Number.isInteger(payload?.id) || payload.id <= 0) {
    return res.status(403).json({ error: 'Token inválido o expirado' });
  }

  try {
    // No confiar en el rol ni en el estado guardados en el token:
    // un perfil desactivado pierde acceso de inmediato y los cambios de rol aplican al instante.
    const usuario = await prisma.usuario.findUnique({
      where: { id: payload.id },
      select: { id: true, email: true, nombre: true, rol: true, activo: true }
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
      error: `Acceso denegado: Se requiere rol [${rolesPermitidos.join(', ')}]. Tu rol actual es '${req.user.rol}'`
    });
  }

  next();
};
