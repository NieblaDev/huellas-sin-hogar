import prisma from '../config/prisma.js';
import { registrarAuditoria } from './audit.service.js';

/**
 * Obtener todos los caniles con el animal alojado si existe
 */
export const getAllCaniles = async () => {
  const caniles = await prisma.canil.findMany({
    include: {
      animalAlojado: {
        select: {
          id: true,
          nombre: true,
          especie: true,
          sexo: true,
          edad: true,
          raza: true,
          estadoSalud: true,
          fotoUrl: true,
          nota: true
        }
      }
    },
    orderBy: { id: 'asc' }
  });

  const total = caniles.length;
  const ocupados = caniles.filter(c => c.estado === 'OCUPADO').length;
  const cuarentena = caniles.filter(c => c.estado === 'CUARENTENA').length;
  const mantenimiento = caniles.filter(c => c.estado === 'MANTENIMIENTO').length;
  const libres = caniles.filter(c => c.estado === 'LIBRE').length;

  const porcentajeOcupacion = total > 0 ? Math.round(((ocupados + cuarentena) / total) * 100) : 0;
  const alertaSobrecupo = porcentajeOcupacion > 90;

  return {
    resumen: {
      total,
      libres,
      ocupados,
      cuarentena,
      mantenimiento,
      porcentajeOcupacion,
      alertaSobrecupo
    },
    caniles
  };
};

/**
 * Asignar o reubicar un animal a un canil interno
 * Requisito 1:
 * - El miembro autenticado asigna/reubica
 * - Requiere motivo y responsable obligatorio
 * - Solo se permite si el canil tiene capacidad libre
 * - Canil queda OCUPADO, se actualiza la ficha del animal
 * - Alerta visual si ocupación supera el 90%
 */
export const asignarCanil = async ({ canilId, animalId, motivo, estado = 'OCUPADO' }, user, ip) => {
  if (!motivo || motivo.trim().length < 3) {
    throw new Error('El motivo del movimiento es obligatorio');
  }

  const targetCanil = await prisma.canil.findUnique({
    where: { id: Number(canilId) },
    include: { animalAlojado: true }
  });

  if (!targetCanil) throw new Error('El canil seleccionado no existe');

  // Si se está asignando un animal, verificar capacidad
  if (animalId) {
    const animal = await prisma.animal.findUnique({
      where: { id: Number(animalId) },
      include: { canil: true }
    });

    if (!animal) throw new Error('El animal no existe');

    // Validar si el canil destino ya está ocupado por otro animal
    if (targetCanil.animalAlojado && targetCanil.animalAlojado.id !== animal.id) {
      throw new Error(`El canil ${targetCanil.nombre} ya se encuentra ocupado por ${targetCanil.animalAlojado.nombre}`);
    }

    const canilAnteriorId = animal.canilId;

    // Liberar canil anterior si era diferente
    if (canilAnteriorId && canilAnteriorId !== targetCanil.id) {
      await prisma.canil.update({
        where: { id: canilAnteriorId },
        data: { estado: 'LIBRE' }
      });
    }

    // Actualizar canil destino
    const canilActualizado = await prisma.canil.update({
      where: { id: targetCanil.id },
      data: { estado }
    });

    // Actualizar animal con la nueva ubicación
    const animalActualizado = await prisma.animal.update({
      where: { id: animal.id },
      data: { canilId: targetCanil.id }
    });

    // Registrar traslado interno
    await prisma.traslado.create({
      data: {
        animalId: animal.id,
        tipo: 'INTERNO_CANIL',
        motivo,
        estado: 'COMPLETADO',
        canilOrigenId: canilAnteriorId || null,
        canilDestinoId: targetCanil.id,
        responsableId: user.id
      }
    });

    // Auditoría
    await registrarAuditoria({
      entidad: 'Canil',
      entidadId: targetCanil.id,
      accion: 'MODIFICACION',
      valorAnterior: { canil: targetCanil.nombre, estadoAnterior: targetCanil.estado, animalAnterior: targetCanil.animalAlojado?.nombre },
      valorNuevo: { canil: targetCanil.nombre, estadoNuevo: estado, animalAsignado: animal.nombre, motivo },
      usuario: user,
      ip
    });

    // Calcular ocupación para emitir alerta > 90%
    const { resumen } = await getAllCaniles();

    return {
      success: true,
      mensaje: `Animal ${animal.nombre} asignado al ${targetCanil.nombre}`,
      animal: animalActualizado,
      canil: canilActualizado,
      alertaSobrecupo: resumen.alertaSobrecupo,
      porcentajeOcupacion: resumen.porcentajeOcupacion
    };
  } else {
    // Liberación de canil
    const valorAnterior = { ...targetCanil };
    // Quitar relación en el animal
    if (targetCanil.animalAlojado) {
      await prisma.animal.update({
        where: { id: targetCanil.animalAlojado.id },
        data: { canilId: null }
      });
    }

    const canilLiberado = await prisma.canil.update({
      where: { id: targetCanil.id },
      data: { estado: 'LIBRE' }
    });

    await registrarAuditoria({
      entidad: 'Canil',
      entidadId: targetCanil.id,
      accion: 'MODIFICACION',
      valorAnterior,
      valorNuevo: { estado: 'LIBRE', motivo },
      usuario: user,
      ip
    });

    return {
      success: true,
      mensaje: `Canil ${targetCanil.nombre} liberado`,
      canil: canilLiberado
    };
  }
};

/**
 * Solicitar traslado externo (Protectora Aliada u Hogar Temporal)
 * Requisito 1:
 * - Registra traslado a protectora u hogar temporal
 * - Debe ser aprobado por la Directora
 * - Motivo y responsable obligatorios
 */
export const solicitarTrasladoExterno = async ({
  animalId,
  tipo, // 'PROTECTORA_ALIADA' | 'HOGAR_TEMPORAL'
  motivo,
  destinoNombre,
  destinoContacto,
  destinoDireccion
}, user, ip) => {
  if (!motivo || motivo.trim().length < 3) {
    throw new Error('El motivo del traslado es obligatorio');
  }
  if (!destinoNombre || destinoNombre.trim().length < 2) {
    throw new Error('El nombre de la protectora u hogar temporal de destino es obligatorio');
  }

  const animal = await prisma.animal.findUnique({
    where: { id: Number(animalId) },
    include: { canil: true }
  });
  if (!animal) throw new Error('Animal no encontrado');

  const traslado = await prisma.traslado.create({
    data: {
      animalId: animal.id,
      tipo,
      motivo,
      destinoNombre,
      destinoContacto,
      destinoDireccion,
      canilOrigenId: animal.canilId,
      responsableId: user.id,
      estado: 'PENDIENTE_APROBACION'
    },
    include: {
      animal: true,
      responsable: { select: { id: true, nombre: true, email: true, rol: true } }
    }
  });

  await registrarAuditoria({
    entidad: 'Traslado',
    entidadId: traslado.id,
    accion: 'CREACION',
    valorAnterior: null,
    valorNuevo: {
      animal: animal.nombre,
      tipo,
      destino: destinoNombre,
      motivo,
      estado: 'PENDIENTE_APROBACION'
    },
    usuario: user,
    ip
  });

  return traslado;
};

/**
 * Aprobar o rechazar traslado externo (Solo Directora)
 */
export const gestionarAprobacionTraslado = async (trasladoId, { aprobar, comentario }, user, ip) => {
  const traslado = await prisma.traslado.findUnique({
    where: { id: Number(trasladoId) },
    include: { animal: true, canilOrigen: true }
  });

  if (!traslado) throw new Error('Traslado no encontrado');
  if (traslado.estado !== 'PENDIENTE_APROBACION') {
    throw new Error(`El traslado ya se encuentra en estado ${traslado.estado}`);
  }

  const nuevoEstado = aprobar ? 'APROBADO' : 'RECHAZADO';

  const trasladoActualizado = await prisma.traslado.update({
    where: { id: traslado.id },
    data: {
      estado: nuevoEstado,
      aprobadoPorId: user.id,
      fechaAprobacion: new Date(),
      comentarioAprobacion: comentario || null
    }
  });

  // Si fue aprobado, liberamos el canil anterior del animal
  if (aprobar && traslado.animal.canilId) {
    await prisma.canil.update({
      where: { id: traslado.animal.canilId },
      data: { estado: 'LIBRE' }
    });

    await prisma.animal.update({
      where: { id: traslado.animal.id },
      data: {
        canilId: null,
        nota: `${traslado.animal.nota || ''} [Trasladado a ${traslado.destinoNombre} (${traslado.tipo})]`
      }
    });
  }

  await registrarAuditoria({
    entidad: 'Traslado',
    entidadId: traslado.id,
    accion: 'MODIFICACION',
    valorAnterior: { estado: traslado.estado },
    valorNuevo: { estado: nuevoEstado, aprobadoPor: user.nombre, comentario },
    usuario: user,
    ip
  });

  return trasladoActualizado;
};

/**
 * Listar traslados con filtro opcional de estado
 */
export const getTraslados = async ({ estado }) => {
  const where = {};
  if (estado) where.estado = estado;

  return await prisma.traslado.findMany({
    where,
    orderBy: { fechaRegistro: 'desc' },
    include: {
      animal: true,
      responsable: { select: { id: true, nombre: true, email: true, rol: true } },
      aprobadoPor: { select: { id: true, nombre: true, email: true, rol: true } },
      canilOrigen: true,
      canilDestino: true
    }
  });
};
