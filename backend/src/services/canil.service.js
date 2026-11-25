import { ErrorDominio } from '../utils/errorDominio.js';
import prisma from '../config/prisma.js';
import { registrarAuditoria } from './audit.service.js';
import { etiquetaRolUsuario } from '../constants/usuarios.js';

import { buscarCanil, bloquearCaniles, ocupacionDeCanil, registrarMovimiento, sincronizarEstadoCanil, validarIngresoAnimal, validarSalida } from './canilOcupacion.js';
import { iniciarCuarentena } from './cuarentena.service.js';
import { diasEntre, diferenciaDias } from '../utils/fechas.js';

const SELECT_RESPONSABLE_TRASLADO = { id: true, nombre: true, email: true, rol: true, sexo: true };

const serializarTraslado = ({ responsable, ...traslado }) => {
  const { sexo, ...usuario } = responsable;
  return { ...traslado, responsable: { ...usuario, rolEtiqueta: etiquetaRolUsuario(usuario.rol, sexo) } };
};

const incluir = {
  animales: { orderBy: { id: 'asc' }, select: { id: true, nombre: true, especie: true, sexo: true, edad: true, raza: true, estadoSalud: true, fotoUrl: true, nota: true, fechaIngresoCanil: true, creadoEn: true, activo: true, estadoAdopcion: true } },
  cuarentenas: { where: { estado: 'ACTIVA' }, orderBy: { id: 'asc' }, take: 1 }
};
function detalle({ animales, cuarentenas, ...canil }) {
  animales = animales.map(a => ({ ...a, diasEnCanil: diasEntre(a.fechaIngresoCanil) }));
  const q = cuarentenas[0];
  const diasRestantes = q && diferenciaDias(new Date(), q.fechaFinEstimada);
  return { ...canil, animales, animalAlojado: animales[0] || null, ocupacion: ocupacionDeCanil({ ...canil, animales }),
    cuarentena: q ? { ...q, diasRestantes, vencida: diasRestantes < 0 } : null };
}
export async function getCanil(id, db = prisma) {
  const c = await db.canil.findUnique({ where: { id }, include: incluir });
  if (!c) throw new ErrorDominio(404, 'Canil no encontrado.');
  return detalle(c);
}
export async function getAllCaniles() {
  const caniles = (await prisma.canil.findMany({ include: incluir, orderBy: { id: 'asc' } })).map(detalle);
  const cantidad = estado => caniles.filter(c => c.estado === estado).length;
  const capacidadTotal = caniles.reduce((s,c) => s+c.capacidad, 0);
  const animalesAlojados = caniles.reduce((s,c) => s+c.animales.length, 0);
  const porcentajeOcupacion = capacidadTotal ? Math.round(animalesAlojados * 100 / capacidadTotal) : 0;
  return { caniles, resumen: { total: caniles.length, libres: cantidad('LIBRE'), ocupados: cantidad('OCUPADO'),
    cuarentena: cantidad('CUARENTENA'), mantenimiento: cantidad('MANTENIMIENTO'), capacidadTotal, animalesAlojados,
    cuposLibres: capacidadTotal - animalesAlojados, porcentajeOcupacion, alertaSobrecupo: porcentajeOcupacion > 90 } };
}

export async function asignarCanil(datos, user, ip) {
  if (datos.estado === 'MANTENIMIENTO' && datos.animalId) throw new ErrorDominio(400, 'El mantenimiento requiere un canil vacío.');
  const { canilId, animalId, estado, confirmarLiberacionMultiple, origenEsperadoId } = datos;
  const resultado = await prisma.$transaction(async tx => {
    let animal;
    if (animalId) {
      await tx.$queryRaw`SELECT id FROM animales WHERE id = ${animalId} FOR UPDATE`;
      animal = await tx.animal.findUnique({ where: { id: animalId } });
      if (!animal) throw new ErrorDominio(404, 'Animal no encontrado.');
      if (origenEsperadoId !== undefined && animal.canilId !== origenEsperadoId) throw new ErrorDominio(409, 'El animal cambió de canil. Actualiza el mapa.');
    }
    await bloquearCaniles(tx, canilId, animal?.canilId);
    const anterior = await getCanil(canilId, tx);
    const motivo = datos.motivo?.trim() || 'Movimiento de canil';
    const liberar = !animal || estado === 'LIBRE';
    if (!animal && estado === 'CUARENTENA') throw new ErrorDominio(400, 'Selecciona un animal para la cuarentena.');
    if (estado === 'MANTENIMIENTO' && (animal || anterior.animales.length)) throw new ErrorDominio(409, 'Libera el canil antes del mantenimiento.');
    if (liberar) {
      if (animal && animal.canilId !== canilId) throw new ErrorDominio(409, 'El animal ya no ocupa este canil.');
      if (!animal && anterior.animales.length > 1 && !confirmarLiberacionMultiple)
        throw new ErrorDominio(409, `El canil tiene ${anterior.animales.length} animales. Confirma la liberación de todos.`);
      for (const a of animal ? [animal] : anterior.animales) {
        await validarSalida(tx, a.id);
        await registrarMovimiento(tx, { ...a, canilId }, null, user.id, motivo);
        await tx.animal.update({ where: { id: a.id }, data: { canilId: null, fechaIngresoCanil: null } });
      }
      if (estado === 'MANTENIMIENTO' || (estado === 'LIBRE' && anterior.estado === 'MANTENIMIENTO'))
        await tx.canil.update({ where: { id: canilId }, data: { estado } });
    } else {
      validarIngresoAnimal({ animal, canil: anterior });
      if (animal.canilId !== canilId) {
        await validarSalida(tx, animal.id);
        await registrarMovimiento(tx, animal, canilId, user.id, motivo);
        await tx.animal.update({ where: { id: animal.id }, data: { canilId, fechaIngresoCanil: new Date() } });
        await sincronizarEstadoCanil(tx, animal.canilId);
      }
      if (estado === 'CUARENTENA') await iniciarCuarentena(tx, { ...datos, animal, canil: anterior, user, ip });
    }
    await sincronizarEstadoCanil(tx, canilId);
    const canil = await getCanil(canilId, tx);
    await registrarAuditoria({ entidad: 'Canil', entidadId: canilId, accion: 'MODIFICACION', valorAnterior: { origen: animal?.canilId, animales: anterior.animales, dias: diasEntre(animal?.fechaIngresoCanil) }, valorNuevo: { animales: canil.animales, estado: canil.estado, motivo }, usuario: user, ip }, tx);
    return { success: true, mensaje: 'Canil actualizado.', canil, animales: canil.animales, animal: canil.animales.find(a => a.id === animalId), cuarentena: canil.cuarentena };
  });
  const { resumen } = await getAllCaniles();
  return { ...resultado, alertaSobrecupo: resumen.alertaSobrecupo, porcentajeOcupacion: resumen.porcentajeOcupacion };
}

export const actualizarCanil = (id, data, user, ip) => prisma.$transaction(async tx => {
  await bloquearCaniles(tx, id);
  const anterior = await buscarCanil(tx, id);
  if (data.capacidad < anterior.animales.length) throw new ErrorDominio(409, `No puedes reducir la capacidad por debajo de los ${anterior.animales.length} animales alojados.`);
  if (data.capacidad > 1 && anterior.estado === 'CUARENTENA') throw new ErrorDominio(409, 'El canil está en cuarentena.');
  if (data.tipo && data.tipo !== 'Mixto' && anterior.animales.some(a => a.especie !== data.tipo)) throw new ErrorDominio(409, 'Hay animales incompatibles con el nuevo tipo.');
  const canil = await tx.canil.update({ where: { id }, data });
  await registrarAuditoria({ entidad: 'Canil', entidadId: id, accion: 'MODIFICACION', valorAnterior: anterior, valorNuevo: canil, usuario: user, ip }, tx);
  return canil;
});

/**
 * Solicitar traslado externo (Protectora Aliada u Hogar Temporal)
 * Requisito 1:
 * - Registra traslado a protectora u hogar temporal
 * - Debe ser aprobado por Dirección
 * - Motivo y responsable obligatorios
 */
export const solicitarTrasladoExterno = async ({
  animalId,
  tipo, // 'PROTECTORA_ALIADA' | 'HOGAR_TEMPORAL'
  motivo,
  destinoNombre,
  destinoContacto,
  destinoEmail,
  destinoDireccion
}, user, ip) => {
  if (!motivo || motivo.trim().length < 3) {
    throw new ErrorDominio(400, 'El motivo del traslado es obligatorio');
  }
  if (!destinoNombre || destinoNombre.trim().length < 2) {
    throw new ErrorDominio(400, 'El nombre de la protectora u hogar temporal de destino es obligatorio');
  }

  const animal = await prisma.animal.findUnique({
    where: { id: Number(animalId) },
    include: { canil: true }
  });
  if (!animal) throw new ErrorDominio(404, 'Animal no encontrado');

  const traslado = await prisma.traslado.create({
    data: {
      animalId: animal.id,
      tipo,
      motivo,
      destinoNombre,
      destinoContacto,
      ...(tipo === 'PROTECTORA_ALIADA' && {
        destinoEmail,
        correoEstado: 'PENDIENTE',
        correoDisponibleEn: new Date()
      }),
      destinoDireccion,
      canilOrigenId: animal.canilId,
      responsableId: user.id,
      estado: 'PENDIENTE_APROBACION'
    },
    include: {
      animal: true,
      responsable: { select: SELECT_RESPONSABLE_TRASLADO }
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

  return serializarTraslado(traslado);
};

/**
 * Aprobar o rechazar traslado externo (Solo Dirección)
 */
export const gestionarAprobacionTraslado = async (trasladoId, { aprobar, comentario }, user, ip) => {
  const traslado = await prisma.traslado.findUnique({
    where: { id: Number(trasladoId) },
    include: { animal: true, canilOrigen: true }
  });

  if (!traslado) throw new ErrorDominio(404, 'Traslado no encontrado');
  if (traslado.estado !== 'PENDIENTE_APROBACION') {
    throw new ErrorDominio(409, `El traslado ya se encuentra en estado ${traslado.estado}`);
  }

  const nuevoEstado = aprobar ? 'APROBADO' : 'RECHAZADO';

  const trasladoActualizado = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM traslados WHERE id = ${traslado.id} FOR UPDATE`;
    const actual = await tx.traslado.findUnique({ where: { id: traslado.id } });
    if (actual.estado !== 'PENDIENTE_APROBACION') throw new ErrorDominio(409, 'El traslado ya fue revisado.');
    const resultado = await tx.traslado.update({
    where: { id: traslado.id },
    data: {
      estado: nuevoEstado,
      aprobadoPorId: user.id,
      fechaAprobacion: new Date(),
      comentarioAprobacion: comentario || null
    }
  });

    if (aprobar) {
      await tx.$queryRaw`SELECT id FROM animales WHERE id = ${traslado.animalId} FOR UPDATE`;
      const animal = await tx.animal.findUnique({ where: { id: traslado.animalId } });
      if (animal.canilId) {
        await bloquearCaniles(tx, animal.canilId);
        await validarSalida(tx, animal.id);
        await registrarMovimiento(tx, animal, null, user.id, 'Traslado externo aprobado');
        await tx.animal.update({ where: { id: animal.id }, data: { canilId: null, fechaIngresoCanil: null,
          nota: `${animal.nota || ''} [Trasladado a ${traslado.destinoNombre} (${traslado.tipo})]` } });
        await sincronizarEstadoCanil(tx, animal.canilId);
      }
    }
    return resultado;
  });

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
 * Crear un nuevo canil
 */
export const createCanil = async ({ codigo, nombre, sector, tipo, capacidad, notas, estado = 'LIBRE' }, user, ip) => {
  // Verificar que el código no exista ya
  const existing = await prisma.canil.findUnique({ where: { codigo } });
  if (existing) {
    throw new ErrorDominio(400, `Ya existe un canil con el código ${codigo}`);
  }

  const canil = await prisma.canil.create({
    data: { codigo, nombre, sector, tipo, notas, capacidad: Number(capacidad) || 1, estado }
  });

  await registrarAuditoria({
    entidad: 'Canil',
    entidadId: canil.id,
    accion: 'CREACION',
    valorAnterior: null,
    valorNuevo: { codigo, nombre, sector, tipo, capacidad, estado },
    usuario: user,
    ip
  });

  return canil;
};

/**
 * Actualizar el sector de un canil existente
 */
export const actualizarSectorCanil = async ({ canilId, sector }, user, ip) => {
  const targetCanil = await prisma.canil.findUnique({
    where: { id: Number(canilId) }
  });

  if (!targetCanil) {
    throw new ErrorDominio(404, 'El canil seleccionado no existe');
  }

  const sectorLimpio = sector.trim();

  const canilActualizado = await prisma.canil.update({
    where: { id: targetCanil.id },
    data: { sector: sectorLimpio }
  });

  await registrarAuditoria({
    entidad: 'Canil',
    entidadId: targetCanil.id,
    accion: 'MODIFICACION',
    valorAnterior: { nombre: targetCanil.nombre, sector: targetCanil.sector },
    valorNuevo: { nombre: canilActualizado.nombre, sector: canilActualizado.sector },
    usuario: user,
    ip
  });

  return {
    success: true,
    mensaje: `Sector del ${canilActualizado.nombre} actualizado a ${sectorLimpio}`,
    canil: canilActualizado
  };
};

/**
 * Eliminar un canil (solo si no tiene animal asignado)
 */
export const deleteCanil = async ({ canilId }, user, ip) => {
  return prisma.$transaction(async tx => {
  await bloquearCaniles(tx, Number(canilId));
  const targetCanil = await buscarCanil(tx, Number(canilId));

  if (!targetCanil) {
    throw new ErrorDominio(404, 'El canil seleccionado no existe');
  }

  if (targetCanil.animales.length) {
    throw new ErrorDominio(409, `No se puede eliminar el canil ${targetCanil.nombre} porque tiene un animal asignado. Libérelo primero.`);
  }

  const valorAnterior = { ...targetCanil };

  await tx.canil.delete({
    where: { id: Number(canilId) }
  });

  await registrarAuditoria({
    entidad: 'Canil',
    entidadId: targetCanil.id,
    accion: 'BAJA_LOGICA',
    valorAnterior,
    valorNuevo: { nombre: targetCanil.nombre, codigo: targetCanil.codigo },
    usuario: user,
    ip
  }, tx);

  return { success: true, mensaje: `Canil ${targetCanil.nombre} eliminado correctamente` };
  });
};

/**
 * Listar traslados con filtro opcional de estado
 */
export const getTraslados = async ({ estado }) => {
  const where = {};
  if (estado) where.estado = estado;

  const traslados = await prisma.traslado.findMany({
    where,
    orderBy: { fechaRegistro: 'desc' },
    include: {
      animal: true,
      responsable: { select: SELECT_RESPONSABLE_TRASLADO },
      aprobadoPor: { select: { id: true, nombre: true, email: true, rol: true } },
      canilOrigen: true,
      canilDestino: true
    }
  });
  return traslados.map(serializarTraslado);
};
