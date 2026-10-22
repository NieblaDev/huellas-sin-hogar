import prisma from '../config/prisma.js';

const ROLES_AUTORIZADOS = new Set(['DIRECTORA', 'ENCARGADA_ADOPCIONES']);

export const requireAdopcionStaff = async (req, res, next) => {
  if (!Number.isInteger(req.user?.id) || req.user.id <= 0) {
    return res.status(401).json({ error: 'Sesión inválida' });
  }
  try {
    // No confiar en el rol del JWT: pudo cambiar desde el inicio de sesión.
    const usuario = await prisma.usuario.findUnique({
      where: { id: req.user.id }, select: { id: true, activo: true, rol: true, nombre: true, email: true }
    });
    if (!usuario?.activo || !ROLES_AUTORIZADOS.has(usuario.rol)) {
      return res.status(403).json({ error: 'Se requiere staff autorizado de adopciones' });
    }
    req.adopcionStaff = usuario;
    next();
  } catch {
    res.status(500).json({ error: 'No se pudieron verificar los permisos' });
  }
};
