import prisma from '../config/prisma.js';
import { AdopcionError } from './adopcion.service.js';

const json = value => JSON.parse(JSON.stringify(value));

const incluirRelaciones = {
  adopcion: {
    include: {
      animal: {
        select: { id: true, nombre: true, especie: true, chip: true, fotoUrl: true, estadoSalud: true }
      },
      postulante: {
        select: { id: true, nombre: true, rut: true, tipoIdentificacion: true, telefono: true, email: true, direccion: true }
      }
    }
  },
  responsable: {
    select: { id: true, nombre: true, email: true, rol: true }
  },
  intentos: {
    include: {
      responsable: { select: { id: true, nombre: true, email: true } }
    },
    orderBy: { fecha: 'desc' }
  }
};

export const listarSeguimientos = async query => {
  const where = {};
  if (query.adopcionId) where.adopcionId = Number(query.adopcionId);
  if (query.estado) where.estado = query.estado;
  if (query.alertaSinContacto !== undefined) where.alertaSinContacto = Boolean(query.alertaSinContacto);

  const total = await prisma.seguimientoAdopcion.count({ where });
  const pagina = Math.max(1, Number(query.pagina) || 1);
  const limite = Math.min(50, Math.max(1, Number(query.limite) || 20));
  const skip = (pagina - 1) * limite;

  const seguimientos = await prisma.seguimientoAdopcion.findMany({
    where,
    include: incluirRelaciones,
    orderBy: [
      { alertaSinContacto: 'desc' },
      { fechaProgramada: 'asc' },
      { id: 'asc' }
    ],
    skip,
    take: limite
  });

  return {
    seguimientos,
    total,
    pagina,
    limite,
    totalPaginas: Math.ceil(total / limite) || 1
  };
};

export const obtenerSeguimiento = async id => {
  const seguimiento = await prisma.seguimientoAdopcion.findUnique({
    where: { id: Number(id) },
    include: incluirRelaciones
  });
  if (!seguimiento) throw new AdopcionError(404, 'Seguimiento no encontrado');
  return seguimiento;
};

export const registrarSeguimiento = async (id, data, responsable, ip) => {
  const seguimientoId = Number(id);
  return await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM seguimientos_adopcion WHERE id = ${seguimientoId} FOR UPDATE`;
    const anterior = await tx.seguimientoAdopcion.findUnique({
      where: { id: seguimientoId },
      include: { adopcion: true }
    });

    if (!anterior) throw new AdopcionError(404, 'Seguimiento no encontrado');
    if (anterior.adopcion.devolucion) {
      throw new AdopcionError(409, 'No se puede registrar seguimiento a una adopción devuelta.');
    }
    if (anterior.estado === 'COMPLETADO') {
      throw new AdopcionError(409, 'El seguimiento ya fue registrado y completado previamente.');
    }
    if (data.actualizadoEn && anterior.actualizadoEn.toISOString() !== data.actualizadoEn) {
      throw new AdopcionError(409, 'El seguimiento cambió. Recarga los datos antes de continuar.');
    }

    const fecha = new Date(data.fecha);
    if (fecha.getTime() > Date.now()) {
      throw new AdopcionError(400, 'La fecha de contacto realizado no puede estar en el futuro.');
    }
    if (fecha.getTime() < new Date(anterior.adopcion.fecha).getTime()) {
      throw new AdopcionError(400, 'La fecha del seguimiento no puede ser anterior a la entrega de la adopción.');
    }

    const actualizado = await tx.seguimientoAdopcion.update({
      where: { id: seguimientoId },
      data: {
        fechaEjecucion: fecha,
        canalContacto: data.canalContacto,
        estadoAnimal: data.estadoAnimal,
        resultado: data.resultado,
        observaciones: data.observaciones || null,
        estado: 'COMPLETADO',
        alertaSinContacto: false,
        responsableId: responsable.id
      },
      include: incluirRelaciones
    });

    // Registrar el intento exitoso en el historial de intentos
    await tx.intentoSeguimiento.create({
      data: {
        seguimientoId,
        numeroIntento: anterior.intentosFallidos + 1,
        fecha,
        canalContacto: data.canalContacto,
        contactado: true,
        resultado: data.resultado,
        observaciones: data.observaciones || null,
        responsableId: responsable.id
      }
    });

    await tx.auditoria.create({
      data: {
        usuarioId: responsable.id,
        usuarioNombre: responsable.nombre,
        usuarioEmail: responsable.email,
        ipAddress: ip,
        entidad: 'SeguimientoAdopcion',
        entidadId: seguimientoId,
        accion: 'MODIFICACION',
        valorAnterior: json(anterior),
        valorNuevo: json(actualizado)
      }
    });

    return actualizado;
  });
};

export const reprogramarSeguimiento = async (id, data, responsable, ip) => {
  const seguimientoId = Number(id);
  return await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM seguimientos_adopcion WHERE id = ${seguimientoId} FOR UPDATE`;
    const anterior = await tx.seguimientoAdopcion.findUnique({
      where: { id: seguimientoId },
      include: { adopcion: true }
    });

    if (!anterior) throw new AdopcionError(404, 'Seguimiento no encontrado');
    if (anterior.adopcion.devolucion) {
      throw new AdopcionError(409, 'No se puede gestionar seguimiento de una adopción devuelta.');
    }
    if (anterior.estado === 'COMPLETADO') {
      throw new AdopcionError(409, 'No se puede reprogramar un seguimiento que ya fue completado.');
    }
    if (data.actualizadoEn && anterior.actualizadoEn.toISOString() !== data.actualizadoEn) {
      throw new AdopcionError(409, 'El seguimiento cambió. Recarga los datos antes de continuar.');
    }

    const fechaIntento = new Date(data.fechaIntento);
    const fechaReprogramada = new Date(data.fechaReprogramada);
    if (fechaIntento.getTime() > Date.now()) {
      throw new AdopcionError(400, 'La fecha del intento fallido no puede estar en el futuro.');
    }
    if (fechaReprogramada.getTime() <= Date.now()) {
      throw new AdopcionError(400, 'La fecha reprogramada debe ser una fecha futura.');
    }
    if (fechaReprogramada.getTime() <= fechaIntento.getTime()) {
      throw new AdopcionError(400, 'La fecha reprogramada debe ser posterior al intento fallido.');
    }

    const nuevoIntentosFallidos = anterior.intentosFallidos + 1;
    const alcanzaLimite = nuevoIntentosFallidos >= anterior.limiteIntentos;
    const nuevoEstado = alcanzaLimite ? 'SIN_CONTACTO' : 'REPROGRAMADO';
    const alertaSinContacto = alcanzaLimite;
    const fechaAlerta = alcanzaLimite ? new Date() : null;

    const intento = await tx.intentoSeguimiento.create({
      data: {
        seguimientoId,
        numeroIntento: nuevoIntentosFallidos,
        fecha: fechaIntento,
        canalContacto: data.canalContacto,
        contactado: false,
        resultado: data.resultado,
        observaciones: data.observaciones,
        fechaReprogramada,
        responsableId: responsable.id
      }
    });

    const actualizado = await tx.seguimientoAdopcion.update({
      where: { id: seguimientoId },
      data: {
        intentosFallidos: nuevoIntentosFallidos,
        fechaProgramada: fechaReprogramada,
        estado: nuevoEstado,
        alertaSinContacto,
        fechaAlerta,
        responsableId: responsable.id
      },
      include: incluirRelaciones
    });

    await tx.auditoria.create({
      data: {
        usuarioId: responsable.id,
        usuarioNombre: responsable.nombre,
        usuarioEmail: responsable.email,
        ipAddress: ip,
        entidad: 'SeguimientoAdopcion',
        entidadId: seguimientoId,
        accion: 'MODIFICACION',
        valorAnterior: json(anterior),
        valorNuevo: json({ ...actualizado, intentoRegistrado: intento.id, alertaGenerada: alertaSinContacto })
      }
    });

    return {
      seguimiento: actualizado,
      intento,
      alertaGenerada: alertaSinContacto
    };
  });
};

export const programarSeguimientoManual = async (data, responsable, ip) => {
  const adopcionId = Number(data.adopcionId);
  const adopcion = await prisma.adopcion.findUnique({
    where: { id: adopcionId },
    include: { animal: true }
  });
  if (!adopcion) throw new AdopcionError(404, 'Adopción no encontrada');
  if (adopcion.devolucion) throw new AdopcionError(409, 'No se puede programar seguimiento a una adopción devuelta.');

  const configMax = await prisma.configuracionSistema.findUnique({ where: { clave: 'SEGUIMIENTO_MAX_INTENTOS' } });
  const limiteIntentos = configMax ? parseInt(configMax.valor, 10) || 3 : 3;

  const seguimiento = await prisma.seguimientoAdopcion.create({
    data: {
      adopcionId,
      tipoSeguimiento: data.tipoSeguimiento || 'EXTRAORDINARIO',
      diasProgramados: data.diasProgramados || 15,
      fechaProgramada: new Date(data.fechaProgramada),
      observaciones: data.observaciones || null,
      limiteIntentos,
      estado: 'PENDIENTE',
      responsableId: responsable.id
    },
    include: incluirRelaciones
  });

  await prisma.auditoria.create({
    data: {
      usuarioId: responsable.id,
      usuarioNombre: responsable.nombre,
      usuarioEmail: responsable.email,
      ipAddress: ip,
      entidad: 'SeguimientoAdopcion',
      entidadId: seguimiento.id,
      accion: 'CREACION',
      valorNuevo: json(seguimiento)
    }
  });

  return seguimiento;
};

export const obtenerConfiguracionLimite = async () => {
  const config = await prisma.configuracionSistema.findUnique({
    where: { clave: 'SEGUIMIENTO_MAX_INTENTOS' }
  });
  return {
    clave: 'SEGUIMIENTO_MAX_INTENTOS',
    limite: config ? parseInt(config.valor, 10) || 3 : 3,
    descripcion: config?.descripcion || 'Límite configurable de intentos fallidos antes de alerta sin contacto'
  };
};

export const actualizarConfiguracionLimite = async (data, responsable, ip) => {
  const valor = String(data.limite);
  const anterior = await prisma.configuracionSistema.findUnique({
    where: { clave: 'SEGUIMIENTO_MAX_INTENTOS' }
  });

  const actualizado = await prisma.configuracionSistema.upsert({
    where: { clave: 'SEGUIMIENTO_MAX_INTENTOS' },
    create: {
      clave: 'SEGUIMIENTO_MAX_INTENTOS',
      valor,
      descripcion: 'Límite configurable de intentos fallidos antes de alerta sin contacto'
    },
    update: {
      valor
    }
  });

  await prisma.auditoria.create({
    data: {
      usuarioId: responsable.id,
      usuarioNombre: responsable.nombre,
      usuarioEmail: responsable.email,
      ipAddress: ip,
      entidad: 'ConfiguracionSistema',
      entidadId: actualizado.id,
      accion: anterior ? 'MODIFICACION' : 'CREACION',
      ...(anterior && { valorAnterior: json(anterior) }),
      valorNuevo: json(actualizado)
    }
  });

  return {
    clave: 'SEGUIMIENTO_MAX_INTENTOS',
    limite: parseInt(actualizado.valor, 10)
  };
};
