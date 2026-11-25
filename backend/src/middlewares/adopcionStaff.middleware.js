const ROLES_AUTORIZADOS = new Set(['DIRECCION', 'PERSONAL_ADOPCIONES']);

export const requireAdopcionStaff = (req, res, next) => {
  if (!Number.isInteger(req.user?.id) || req.user.id <= 0) {
    return res.status(401).json({ error: 'Sesión inválida' });
  }
  if (!req.user.activo || !ROLES_AUTORIZADOS.has(req.user.rol)) {
    return res.status(403).json({ error: 'Se requiere staff autorizado de adopciones' });
  }
  req.adopcionStaff = req.user;
  next();
};
