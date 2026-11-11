import prisma from '../config/prisma.js';

/**
 * Servicio centralizado de Auditoría Inmutable
 * Registra acciones: CREACION, MODIFICACION, BAJA_LOGICA
 * Guarda usuario responsable, fecha/hora, valores anteriores y nuevos
 */
export const registrarAuditoria = async ({
  entidad,
  entidadId = null,
  accion,
  valorAnterior = null,
  valorNuevo = null,
  usuario = null,
  ip = null
}) => {
  try {
    return await prisma.auditoria.create({
      data: {
        entidad,
        entidadId: entidadId ? Number(entidadId) : null,
        accion,
        valorAnterior: valorAnterior ? JSON.parse(JSON.stringify(valorAnterior)) : null,
        valorNuevo: valorNuevo ? JSON.parse(JSON.stringify(valorNuevo)) : null,
        usuarioId: usuario?.id || null,
        usuarioEmail: usuario?.email || null,
        usuarioNombre: usuario?.nombre || null,
        ipAddress: ip || null
      }
    });
  } catch (error) {
    console.error('Error al registrar auditoría:', error.message);
    // No bloqueamos la transacción principal si falla auditoría en logs, pero dejamos registro
  }
};

/**
 * Obtener listado de auditoría con filtros avanzados:
 * - usuarioResponsable (email o nombre)
 * - entidad (Animal, Postulante, Insumo, Canil, Traslado)
 * - rango de fechas (desde, hasta)
 */
export const getAuditorias = async ({ usuarioResponsable, entidad, fechaDesde, fechaHasta, limit = 100, page = 1 }) => {
  const where = {};

  if (entidad) {
    where.entidad = { equals: entidad, mode: 'insensitive' };
  }

  if (usuarioResponsable) {
    where.OR = [
      { usuarioEmail: { contains: usuarioResponsable, mode: 'insensitive' } },
      { usuarioNombre: { contains: usuarioResponsable, mode: 'insensitive' } }
    ];
  }

  if (fechaDesde || fechaHasta) {
    where.fechaHora = {};
    if (fechaDesde) {
      where.fechaHora.gte = new Date(fechaDesde);
    }
    if (fechaHasta) {
      // Final del día si solo viene YYYY-MM-DD
      const hastaDate = new Date(fechaHasta);
      hastaDate.setHours(23, 59, 59, 999);
      where.fechaHora.lte = hastaDate;
    }
  }

  const take = Math.min(Number(limit) || 100, 200);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  const [total, registros] = await Promise.all([
    prisma.auditoria.count({ where }),
    prisma.auditoria.findMany({
      where,
      orderBy: { fechaHora: 'desc' },
      skip,
      take,
      include: {
        usuario: {
          select: { id: true, nombre: true, email: true, rol: true }
        }
      }
    })
  ]);

  // Enriquecer cada registro con el nombre de la entidad afectada
  // (típicamente el animal) para mostrar una descripción legible de la acción.
  const animalIds = registros
    .filter(r => r.entidad === 'Animal' && r.entidadId)
    .map(r => r.entidadId);
  const animales = animalIds.length
    ? await prisma.animal.findMany({ where: { id: { in: animalIds } }, select: { id: true, nombre: true } })
    : [];
  const nombrePorAnimalId = new Map(animales.map(a => [a.id, a.nombre]));

  const registrosConNombre = registros.map(r => {
    const snapshot = r.valorNuevo || r.valorAnterior || {};
    const nombreEnSnapshot = snapshot.nombre
      || (typeof snapshot.animal === 'string' ? snapshot.animal : null)
      || snapshot.animal?.nombre
      || null;
    const entidadNombre = r.entidad === 'Animal'
      ? (nombrePorAnimalId.get(r.entidadId) || nombreEnSnapshot)
      : nombreEnSnapshot;

    return { ...r, entidadNombre: entidadNombre || null };
  });

  return {
    total,
    page: Number(page) || 1,
    limit: take,
    registros: registrosConNombre
  };
};
