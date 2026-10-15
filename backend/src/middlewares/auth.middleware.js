import jwt from 'jsonwebtoken';

export const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token requerido' });

  jwt.verify(token, process.env.JWT_SECRET || 'huellas_secret_key_2026', (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido o expirado' });
    req.user = user;
    next();
  });
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