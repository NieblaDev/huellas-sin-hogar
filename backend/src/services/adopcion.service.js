import prisma from '../config/prisma.js';
import { ESTADOS_ACTIVOS } from '../schemas/adopcion.schema.js';
import { normalizarIdentificacion } from '../utils/postulanteIdentificacion.js';

export class AdopcionError extends Error {
  constructor(status, message, alertas = []) {
    super(message);
    this.status = status;
    this.alertas = alertas;
  }
}

const usuarioResumen = { id: true, nombre: true };
const animalResumen = { id: true, nombre: true, especie: true, estadoSalud: true };
const solicitudInclude = { postulante: true, animal: { select: animalResumen }, registradoPor: { select: usuarioResumen } };
const ETAPAS_CONCRETADAS = ['Adoptado', 'Entregada', 'Seguimiento 15d', 'Seguimiento 30d'];
const ETAPAS_TERMINALES = [...ETAPAS_CONCRETADAS, 'Rechazada', 'Cancelada', 'Devuelto'];
const adopcionVigente = { devolucion: false, registroDevolucion: { is: null }, etapa: { in: ETAPAS_CONCRETADAS } };
const presentarPostulante = p => p ? { ...p, identificacion: normalizarIdentificacion(p.rut, p.tipoIdentificacion) } : null;
const presentarSolicitud = s => ({ ...s, postulante: presentarPostulante(s.postulante) });

// Reutiliza Postulante.rut y reconoce también los RUT con formato del módulo existente.
// La expresión coincide con el índice de la migración; todos los valores van parametrizados.
const buscarPostulante = async (db, { tipoIdentificacion, identificacion }) => {
  const rows = await db.$queryRaw`
    SELECT id FROM postulantes
    WHERE "tipoIdentificacion"::text = ${tipoIdentificacion}
      AND (CASE WHEN "tipoIdentificacion" = 'RUT'
        THEN regexp_replace(upper(rut), '[.[:space:]-]', '', 'g')
        ELSE regexp_replace(upper(rut), '[[:space:]]', '', 'g') END) = ${identificacion}
    LIMIT 1`;
  return rows.length ? db.postulante.findUnique({ where: { id: rows[0].id } }) : null;
};

const consultarAntecedentes = async (db, postulante) => {
  if (!postulante) return { postulante: null, solicitudesActivas: [], devolucionesPrevias: [], alertas: [] };
  const [actuales, anteriores, devueltas] = await Promise.all([
    db.solicitudAdopcion.findMany({
      where: { postulanteId: postulante.id, estado: { in: ESTADOS_ACTIVOS } },
      select: { id: true, estado: true, creadoEn: true, animal: { select: animalResumen } }, orderBy: { creadoEn: 'desc' }
    }),
    db.adopcion.findMany({
      where: { postulanteId: postulante.id, solicitudId: null, devolucion: false, registroDevolucion: { is: null }, etapa: { notIn: ETAPAS_TERMINALES } },
      select: { id: true, etapa: true, fecha: true, animal: { select: animalResumen } }
    }),
    db.adopcion.findMany({
      where: { postulanteId: postulante.id, OR: [{ devolucion: true }, { etapa: 'Devuelto' }, { registroDevolucion: { isNot: null } }] },
      select: { id: true, registroDevolucion: true }, orderBy: { fecha: 'desc' }
    })
  ]);
  const solicitudesActivas = [...actuales, ...anteriores.map(a => ({ id: `anterior-${a.id}`, estado: a.etapa, creadoEn: a.fecha, animal: a.animal }))];
  const devolucionesPrevias = devueltas.map(a => a.registroDevolucion || {
    id: `anterior-${a.id}`, fecha: null, motivo: 'Devolución registrada en el historial anterior, sin detalle adicional.', estadoAnimal: 'Sin registro'
  });
  const alertas = [];
  if (solicitudesActivas.length) alertas.push({ codigo: 'SOLICITUD_ACTIVA', mensaje: 'El postulante ya tiene una solicitud activa. No se puede registrar otra.' });
  if (devolucionesPrevias.length) alertas.push({ codigo: 'DEVOLUCIONES_PREVIAS', mensaje: `El postulante registra ${devolucionesPrevias.length} devolución(es) previa(s). Revisar sus antecedentes.` });
  if (!postulante.activo) alertas.push({ codigo: 'POSTULANTE_INACTIVO', mensaje: 'El postulante está dado de baja. Debe revisarse su registro antes de crear solicitudes.' });
  return { postulante: presentarPostulante(postulante), solicitudesActivas, devolucionesPrevias, alertas };
};

export const obtenerAntecedentes = async identidad => consultarAntecedentes(prisma, await buscarPostulante(prisma, identidad));

export const crearSolicitud = async (data, responsable, ip) => {
  for (let intento = 0; intento < 3; intento += 1) {
    try {
      return await prisma.$transaction(async tx => {
        const animal = await tx.animal.findFirst({ where: { id: data.animalId, activo: true }, select: { id: true } });
        if (!animal) throw new AdopcionError(404, 'El animal seleccionado no existe o está dado de baja');
        if (await tx.adopcion.findFirst({ where: { animalId: data.animalId, ...adopcionVigente }, select: { id: true } })) {
          throw new AdopcionError(409, 'El animal ya tiene una adopción vigente');
        }
        let postulante = await buscarPostulante(tx, data.postulante);
        const antecedentes = await consultarAntecedentes(tx, postulante);
        if (postulante && !postulante.activo) throw new AdopcionError(409, 'El postulante está dado de baja', antecedentes.alertas);
        if (antecedentes.solicitudesActivas.length) throw new AdopcionError(409, 'El postulante ya tiene una solicitud activa', antecedentes.alertas);
        const { tipoIdentificacion, identificacion, ...contacto } = data.postulante;
        const anterior = postulante;
        postulante = postulante
          ? await tx.postulante.update({ where: { id: postulante.id }, data: contacto })
          : await tx.postulante.create({ data: { ...contacto, tipoIdentificacion, rut: identificacion } });
        const solicitud = await tx.solicitudAdopcion.create({
          data: { postulanteId: postulante.id, animalId: data.animalId, registradoPorId: responsable.id, motivacion: data.motivacion, datosPostulante: data.postulante },
          include: solicitudInclude
        });
        // Mismo formato de auditoría del proyecto, dentro de la transacción de creación.
        const autor = { usuarioId: responsable.id, usuarioEmail: responsable.email, usuarioNombre: responsable.nombre, ipAddress: ip };
        await tx.auditoria.create({ data: {
          ...autor, entidad: 'Postulante', entidadId: postulante.id, accion: anterior ? 'MODIFICACION' : 'CREACION',
          ...(anterior && { valorAnterior: JSON.parse(JSON.stringify(anterior)) }), valorNuevo: JSON.parse(JSON.stringify(postulante))
        } });
        await tx.auditoria.create({ data: {
          ...autor, entidad: 'SolicitudAdopcion', entidadId: solicitud.id, accion: 'CREACION', valorNuevo: JSON.parse(JSON.stringify(solicitud))
        } });
        return { solicitud: presentarSolicitud(solicitud), alertas: antecedentes.alertas };
      }, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (error.code === 'P2034' || error.code === 'P2002') {
        if (intento < 2) continue;
        const antecedentes = await obtenerAntecedentes(data.postulante);
        throw new AdopcionError(409, 'No se pudo registrar por un conflicto concurrente. Consulta las solicitudes antes de reintentar.', antecedentes.alertas);
      }
      if (error.code === 'P2003') throw new AdopcionError(409, 'El animal o responsable ya no está disponible');
      throw error;
    }
  }
};

export const listarSolicitudes = async ({ estado, search, pagina, limite }) => {
  const rut = search && normalizarIdentificacion(search);
  const rutConFormato = /^\d{7,8}[\dK]$/.test(rut || '') ? `${Number(rut.slice(0, -1)).toLocaleString('es-CL')}-${rut.slice(-1)}` : search;
  const where = {
    ...(estado && { estado }),
    ...(search && { OR: [
      { postulante: { nombre: { contains: search, mode: 'insensitive' } } },
      { postulante: { rut: { contains: search.trim(), mode: 'insensitive' } } },
      { postulante: { rut: { contains: rut, mode: 'insensitive' } } },
      { postulante: { rut: { contains: rutConFormato, mode: 'insensitive' } } },
      { postulante: { rut: { contains: normalizarIdentificacion(search, 'OTRO'), mode: 'insensitive' } } },
      { animal: { nombre: { contains: search, mode: 'insensitive' } } }
    ] })
  };
  const [solicitudes, total] = await prisma.$transaction([
    prisma.solicitudAdopcion.findMany({ where, include: solicitudInclude, orderBy: [{ creadoEn: 'desc' }, { id: 'desc' }], skip: (pagina - 1) * limite, take: limite }),
    prisma.solicitudAdopcion.count({ where })
  ], { isolationLevel: 'RepeatableRead' });
  return { solicitudes: solicitudes.map(presentarSolicitud), total, pagina, limite };
};

export const obtenerSolicitud = async id => {
  const solicitud = await prisma.solicitudAdopcion.findUnique({ where: { id }, include: solicitudInclude });
  if (!solicitud) throw new AdopcionError(404, 'Solicitud no encontrada');
  return { solicitud: presentarSolicitud(solicitud), antecedentes: await consultarAntecedentes(prisma, solicitud.postulante) };
};

export const listarAnimalesDisponibles = () => prisma.animal.findMany({
  where: { activo: true, adopciones: { none: adopcionVigente } }, select: animalResumen, orderBy: { nombre: 'asc' }
});
