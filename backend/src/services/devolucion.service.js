import prisma from '../config/prisma.js';
import { AdopcionError } from './adopcion.service.js';

const json = value => JSON.parse(JSON.stringify(value));

const incluirRelaciones = {
  adopcion: {
    select: { id: true, fecha: true, etapa: true, devolucion: true }
  },
  animal: {
    select: { id: true, nombre: true, especie: true, chip: true, estadoSalud: true, estadoAdopcion: true, canilId: true }
  },
  postulante: {
    select: { id: true, nombre: true, rut: true, tipoIdentificacion: true, telefono: true, email: true }
  },
  responsable: {
    select: { id: true, nombre: true, email: true, rol: true }
  }
};

export const registrarDevolucion = async (data, responsable, ip) => {
  const adopcionId = Number(data.adopcionId);
  return await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM adopciones WHERE id = ${adopcionId} FOR UPDATE`;
    const adopcion = await tx.adopcion.findUnique({
      where: { id: adopcionId },
      include: { animal: true, postulante: true, registroDevolucion: true }
    });

    if (!adopcion) throw new AdopcionError(404, 'Adopción no encontrada');
    if (adopcion.devolucion || adopcion.registroDevolucion) {
      throw new AdopcionError(409, 'Esta adopción ya tiene una devolución registrada.');
    }
    if (!['Adoptado', 'Entregada', 'Seguimiento 15d', 'Seguimiento 30d'].includes(adopcion.etapa)) {
      throw new AdopcionError(409, 'Solo se puede devolver una adopción que haya sido concretada.');
    }

    const fecha = new Date(data.fecha);
    if (fecha.getTime() > Date.now()) {
      throw new AdopcionError(400, 'La fecha de devolución no puede estar en el futuro.');
    }
    if (fecha.getTime() < new Date(adopcion.fecha).getTime()) {
      throw new AdopcionError(400, 'La fecha de devolución no puede ser anterior a la entrega de la adopción.');
    }

    await tx.$queryRaw`SELECT id FROM animales WHERE id = ${adopcion.animalId} FOR UPDATE`;
    const animal = await tx.animal.findUnique({ where: { id: adopcion.animalId } });
    if (!animal) throw new AdopcionError(404, 'Animal no encontrado');

    let canilAsignado = null;
    if (data.canilId) {
      const canilId = Number(data.canilId);
      await tx.$queryRaw`SELECT id FROM caniles WHERE id = ${canilId} FOR UPDATE`;
      const canil = await tx.canil.findUnique({ where: { id: canilId } });
      if (!canil) throw new AdopcionError(404, 'Canil no encontrado');
      if (canil.estado !== 'LIBRE') throw new AdopcionError(409, 'El canil seleccionado no está libre.');
      canilAsignado = canil;
    }

    // 1. Crear el registro detallado de la devolución
    const devolucion = await tx.devolucion.create({
      data: {
        adopcionId: adopcion.id,
        animalId: adopcion.animalId,
        postulanteId: adopcion.postulanteId,
        fecha,
        motivo: data.motivo,
        estadoAnimal: data.estadoAnimal,
        observacionesPostulante: data.observacionesPostulante || null,
        responsableId: responsable.id
      },
      include: incluirRelaciones
    });

    // 2. Marcar la adopción como devuelta (actualiza el historial del postulante para futuras alertas)
    const adopcionActualizada = await tx.adopcion.update({
      where: { id: adopcion.id },
      data: {
        devolucion: true,
        etapa: 'Devuelto'
      }
    });

    // 3. Registrar reingreso del animal al refugio conservando ficha e historial intactos
    const animalActualizado = await tx.animal.update({
      where: { id: animal.id },
      data: {
        estadoAdopcion: 'EN_REFUGIO',
        canilId: data.canilId ? Number(data.canilId) : null
      }
    });

    // 4. Si se asignó canil, ocuparlo
    if (canilAsignado) {
      await tx.canil.update({
        where: { id: canilAsignado.id },
        data: { estado: 'OCUPADO' }
      });
      await tx.auditoria.create({
        data: {
          usuarioId: responsable.id,
          usuarioNombre: responsable.nombre,
          usuarioEmail: responsable.email,
          ipAddress: ip,
          entidad: 'Canil',
          entidadId: canilAsignado.id,
          accion: 'MODIFICACION',
          valorAnterior: json(canilAsignado),
          valorNuevo: json({ ...canilAsignado, estado: 'OCUPADO', animalAlojadoId: animal.id })
        }
      });
    }

    // 5. Auditar entidades modificadas
    const autor = {
      usuarioId: responsable.id,
      usuarioNombre: responsable.nombre,
      usuarioEmail: responsable.email,
      ipAddress: ip
    };

    await tx.auditoria.create({
      data: {
        ...autor,
        entidad: 'Devolucion',
        entidadId: devolucion.id,
        accion: 'CREACION',
        valorNuevo: json(devolucion)
      }
    });

    await tx.auditoria.create({
      data: {
        ...autor,
        entidad: 'Adopcion',
        entidadId: adopcion.id,
        accion: 'MODIFICACION',
        valorAnterior: json(adopcion),
        valorNuevo: json(adopcionActualizada)
      }
    });

    await tx.auditoria.create({
      data: {
        ...autor,
        entidad: 'Animal',
        entidadId: animal.id,
        accion: 'MODIFICACION',
        valorAnterior: json(animal),
        valorNuevo: json(animalActualizado)
      }
    });

    return {
      devolucion,
      adopcion: adopcionActualizada,
      animal: animalActualizado
    };
  }, { isolationLevel: 'Serializable' });
};

export const listarDevoluciones = async query => {
  const where = {};
  if (query.postulanteId) where.postulanteId = Number(query.postulanteId);
  if (query.animalId) where.animalId = Number(query.animalId);

  const total = await prisma.devolucion.count({ where });
  const pagina = Math.max(1, Number(query.pagina) || 1);
  const limite = Math.min(50, Math.max(1, Number(query.limite) || 20));
  const skip = (pagina - 1) * limite;

  const devoluciones = await prisma.devolucion.findMany({
    where,
    include: incluirRelaciones,
    orderBy: { fecha: 'desc' },
    skip,
    take: limite
  });

  return {
    devoluciones,
    total,
    pagina,
    limite,
    totalPaginas: Math.ceil(total / limite) || 1
  };
};

export const obtenerDevolucion = async id => {
  const devolucion = await prisma.devolucion.findUnique({
    where: { id: Number(id) },
    include: incluirRelaciones
  });
  if (!devolucion) throw new AdopcionError(404, 'Devolución no encontrada');
  return devolucion;
};
