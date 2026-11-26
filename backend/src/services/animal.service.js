import { bloquearCaniles, buscarCanil, registrarMovimiento, sincronizarEstadoCanil, validarEspeciesDelCanil, validarIngresoAnimal, validarSalida } from './canilOcupacion.js';
import { ErrorDominio } from '../utils/errorDominio.js';
import prisma from '../config/prisma.js';
import { registrarAuditoria } from './audit.service.js';
import { notificarPersonalRefugio } from './notification.service.js';

const REGEX_TIPO_INGRESO = /^\[Ingreso por (Rescate|Abandono|Decomiso)\]\s*/i;

const enriquecerFichaAnimal = (animal) => {
  if (!animal) return null;
  const match = (animal.nota || '').match(REGEX_TIPO_INGRESO);
  const tipoIngreso = match ? match[1] : 'Rescate';
  return {
    ...animal,
    tipoIngreso
  };
};

export const getAllAnimals = async ({
  especie,
  estadoSalud,
  search,
  estado,
  incluirBajas,
  tipoIngreso,
  ordenFecha,
  orden
} = {}) => {
  const where = {};

  // Por defecto solo se muestran animales activos (los dados de baja no aparecen).
  const estadoNorm = String(estado || '').trim().toUpperCase();
  if (estadoNorm === 'BAJA' || estadoNorm === 'INACTIVOS') {
    where.activo = false;
  } else if (estadoNorm === 'ADOPCIONES' || estadoNorm === 'ACTIVOS') {
    where.activo = true;
    where.estadoAdopcion = estadoNorm === 'ADOPCIONES' ? 'ADOPTADO' : 'EN_REFUGIO';
  } else if (estadoNorm === 'TODOS' || incluirBajas === 'true' || incluirBajas === true) {
    // Sin restricción en `activo`: devuelve tanto activos como dados de baja
  } else {
    where.activo = true;
  }

  if (especie) where.especie = { equals: especie, mode: 'insensitive' };
  if (estadoSalud) where.estadoSalud = String(estadoSalud).toUpperCase();
  if (search) where.nombre = { contains: search, mode: 'insensitive' };

  const direccion = String(ordenFecha || orden || 'desc').trim().toLowerCase() === 'asc' ? 'asc' : 'desc';

  const lista = await prisma.animal.findMany({
    where,
    include: {
      canil: {
        select: { id: true, codigo: true, nombre: true, sector: true, estado: true }
      },
      creadoPor: {
        select: { id: true, nombre: true, rol: true }
      }
    },
    orderBy: [{ creadoEn: direccion }, { id: direccion }]
  });

  const enriquecidos = lista.map(enriquecerFichaAnimal);

  if (tipoIngreso) {
    const causalNorm = String(tipoIngreso).trim().toLowerCase();
    return enriquecidos.filter((a) => (a.tipoIngreso || '').toLowerCase() === causalNorm);
  }

  return enriquecidos;
};

export const getAnimalById = async (id, user) => {
  const animal = await prisma.animal.findUnique({
    where: { id: Number(id) },
    include: {
      canil: true,
      creadoPor: {
        select: { id: true, nombre: true, email: true, rol: true }
      },
      traslados: {
        orderBy: { fechaRegistro: 'desc' },
        include: {
          canilOrigen: { select: { codigo: true, nombre: true } },
          canilDestino: { select: { codigo: true, nombre: true } },
          responsable: { select: { nombre: true, rol: true } }
        }
      },
      indicacionesCuidado: {
        where: { activo: true },
        orderBy: { fechaInicio: 'desc' },
        select: { id: true, titulo: true, instruccion: true, fechaInicio: true, fechaFin: true, franjaHoraria: true }
      },
      adopciones: {
        orderBy: { fecha: 'desc' },
        include: {
          postulante: true
        }
      }
    }
  });

  if (!animal) throw new ErrorDominio(404, 'Animal no encontrado');

  const ficha = enriquecerFichaAnimal(animal);
  const esDireccion = user?.rol === 'DIRECCION';

  // Restricción de privacidad para roles distintos de Dirección
  if (!esDireccion) {
    ficha.adopciones = (ficha.adopciones || []).map((ad) => ({
      id: ad.id,
      animalId: ad.animalId,
      fecha: ad.fecha,
      etapa: ad.etapa,
      devolucion: ad.devolucion,
      datosPostulanteOmitidos: true
    }));
  }

  return ficha;
};

export const createAnimal = async (data, user, ip) => {
  const {
    canilId,
    tipoIngreso = 'Rescate',
    historialMedico,
    ...animalData
  } = data;

  // Validación en servicio: especie ('Perro'|'Gato') y sexo ('Macho'|'Hembra') obligatorios
  const especieNorm = (animalData.especie || '').trim().toLowerCase();
  if (!['perro', 'gato'].includes(especieNorm)) {
    throw new ErrorDominio(400, 'Debes especificar la especie (canina o felina) y el sexo del animal para completar el ingreso.');
  }
  const sexoNorm = (animalData.sexo || '').trim().toLowerCase();
  if (!['macho', 'hembra'].includes(sexoNorm)) {
    throw new ErrorDominio(400, 'Debes especificar la especie (canina o felina) y el sexo del animal para completar el ingreso.');
  }

  const especieFinal = especieNorm === 'perro' ? 'Perro' : 'Gato';
  const sexoFinal = sexoNorm === 'macho' ? 'Macho' : 'Hembra';
  const causalIngreso = ['Rescate', 'Abandono', 'Decomiso'].includes(tipoIngreso) ? tipoIngreso : 'Rescate';

  const antecedenteClinico =
    (animalData.nota && animalData.nota.trim()) ||
    (historialMedico && historialMedico.trim()) ||
    'Sin antecedentes clínicos registrados al ingreso.';

  const notaConCausal = REGEX_TIPO_INGRESO.test(antecedenteClinico)
    ? antecedenteClinico
    : `[Ingreso por ${causalIngreso}] ${antecedenteClinico}`;

  // Flexibilidad de datos: antecedentes desconocidos se almacenan con valores seguros sin bloquear
  const newAnimal = await prisma.$transaction(async tx => {
    const destino = canilId ? Number(canilId) : null;
    if (destino) {
      await bloquearCaniles(tx, destino);
      validarIngresoAnimal({ animal: { activo: true, especie: especieFinal }, canil: await buscarCanil(tx, destino) });
    }
    const creado = await tx.animal.create({
    data: {
      nombre: animalData.nombre.trim(),
      especie: especieFinal,
      sexo: sexoFinal,
      edad: animalData.edad && animalData.edad.trim() !== '' ? animalData.edad.trim() : 'Desconocida',
      raza: animalData.raza && animalData.raza.trim() !== '' ? animalData.raza.trim() : 'Desconocida',
      peso: animalData.peso !== undefined && animalData.peso !== null && animalData.peso !== '' ? Number(animalData.peso) || 0 : 0,
      chip: animalData.chip && animalData.chip.trim() !== '' ? animalData.chip.trim() : null,
      estadoSalud: animalData.estadoSalud || 'NORMAL',
      nota: notaConCausal,
      fotoUrl: animalData.fotoUrl || null,
      esterilizacion: animalData.esterilizacion && animalData.esterilizacion.trim() !== '' ? animalData.esterilizacion.trim() : 'Desconocido',
      comportamiento: animalData.comportamiento && animalData.comportamiento.trim() !== '' ? animalData.comportamiento.trim() : 'Por evaluar',
      activo: true,
      canilId: destino,
      fechaIngresoCanil: destino ? new Date() : null,
      creadoPorId: user?.id || null
    },
    include: {
      canil: true,
      creadoPor: { select: { id: true, nombre: true, rol: true } }
    }
  });

    if (destino) {
      await registrarMovimiento(tx, { ...creado, canilId: null }, destino, user.id, 'Ingreso al refugio');
      await sincronizarEstadoCanil(tx, destino);
    }
    return creado;
  });

  const fichaCreada = {
    ...newAnimal,
    tipoIngreso: causalIngreso
  };

  // Trazabilidad / Auditoría automática
  await registrarAuditoria({
    entidad: 'Animal',
    entidadId: newAnimal.id,
    accion: 'CREACION',
    valorAnterior: null,
    valorNuevo: fichaCreada,
    usuario: user,
    ip
  });

  // Disparar notificación al personal del refugio
  const notificacion = await notificarPersonalRefugio({
    tipo: 'INGRESO_ANIMAL',
    titulo: `Nuevo ingreso por ${causalIngreso}: ${newAnimal.nombre} (${especieFinal})`,
    mensaje: `${user?.nombre || 'Miembro del equipo'} (${user?.rol || 'Staff'}) registró la ficha del animal ${newAnimal.nombre} (${especieFinal}, ${sexoFinal}) ingresado por ${causalIngreso}. Estado inicial: ${newAnimal.estadoSalud}.`,
    destinatarios: ['DIRECCION', 'PERSONAL_VETERINARIO', 'PERSONAL_ADOPCIONES'],
    usuario: user,
    metadata: {
      animalId: newAnimal.id,
      nombre: newAnimal.nombre,
      especie: especieFinal,
      sexo: sexoFinal,
      tipoIngreso: causalIngreso,
      estadoSalud: newAnimal.estadoSalud
    }
  });

  return {
    ...fichaCreada,
    notificacion
  };
};

export const updateAnimal = async (id, data, user, ip) => {
  if (data.eliminarFoto) data = { ...data, fotoUrl: null };
  const actual = await prisma.animal.findUnique({
    where: { id: Number(id) },
    include: { canil: true }
  });
  if (!actual) throw new ErrorDominio(404, 'Animal no encontrado');

  const matchActual = (actual.nota || '').match(REGEX_TIPO_INGRESO);
  const causalActual = matchActual ? matchActual[1] : 'Rescate';
  const notaBaseActual = (actual.nota || '').replace(REGEX_TIPO_INGRESO, '').trim();

  const causalNueva =
    data.tipoIngreso && ['Rescate', 'Abandono', 'Decomiso'].includes(data.tipoIngreso)
      ? data.tipoIngreso
      : causalActual;

  const updatePayload = {};

  if (data.nombre !== undefined && String(data.nombre).trim() !== '') {
    updatePayload.nombre = String(data.nombre).trim();
  }
  if (data.especie !== undefined && String(data.especie).trim() !== '') {
    const esp = String(data.especie).trim().toLowerCase();
    if (!['perro', 'gato'].includes(esp)) {
      throw new ErrorDominio(400, 'Debes especificar la especie (canina o felina) y el sexo del animal.');
    }
    updatePayload.especie = esp === 'perro' ? 'Perro' : 'Gato';
  }
  if (data.sexo !== undefined && String(data.sexo).trim() !== '') {
    const sx = String(data.sexo).trim().toLowerCase();
    if (!['macho', 'hembra'].includes(sx)) {
      throw new ErrorDominio(400, 'Debes especificar la especie (canina o felina) y el sexo del animal.');
    }
    updatePayload.sexo = sx === 'macho' ? 'Macho' : 'Hembra';
  }
  if (data.edad !== undefined) {
    updatePayload.edad = data.edad && String(data.edad).trim() !== '' ? String(data.edad).trim() : 'Desconocida';
  }
  if (data.raza !== undefined) {
    updatePayload.raza = data.raza && String(data.raza).trim() !== '' ? String(data.raza).trim() : 'Desconocida';
  }
  if (data.peso !== undefined) {
    updatePayload.peso = data.peso === null || data.peso === '' ? 0 : Number(data.peso) || 0;
  }
  if (data.chip !== undefined) {
    updatePayload.chip = data.chip && String(data.chip).trim() !== '' ? String(data.chip).trim() : null;
  }
  if (data.estadoSalud !== undefined && data.estadoSalud !== '') {
    updatePayload.estadoSalud = data.estadoSalud;
  }
  if (data.estadoAdopcion !== undefined && data.estadoAdopcion !== '') {
    updatePayload.estadoAdopcion = data.estadoAdopcion;
  }
  if (data.esterilizacion !== undefined) {
    updatePayload.esterilizacion =
      data.esterilizacion && String(data.esterilizacion).trim() !== ''
        ? String(data.esterilizacion).trim()
        : 'Desconocido';
  }
  if (data.comportamiento !== undefined) {
    updatePayload.comportamiento =
      data.comportamiento && String(data.comportamiento).trim() !== ''
        ? String(data.comportamiento).trim()
        : 'Por evaluar';
  }
  if (data.fotoUrl !== undefined) {
    updatePayload.fotoUrl = data.fotoUrl;
  }

  // Reconstruir campo nota preservando o actualizando la causal de ingreso
  if (data.nota !== undefined || data.historialMedico !== undefined || data.tipoIngreso !== undefined) {
    const textoClinico =
      data.nota !== undefined
        ? String(data.nota || '').replace(REGEX_TIPO_INGRESO, '').trim()
        : data.historialMedico !== undefined
          ? String(data.historialMedico || '').replace(REGEX_TIPO_INGRESO, '').trim()
          : notaBaseActual;

    const cuerpoNota = textoClinico || 'Sin antecedentes clínicos registrados al ingreso.';
    updatePayload.nota = `[Ingreso por ${causalNueva}] ${cuerpoNota}`;
  }

  const actualizado = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM animales WHERE id = ${Number(id)} FOR UPDATE`;
    const animal = await tx.animal.findUniqueOrThrow({ where: { id: Number(id) } });
    const destino = updatePayload.estadoAdopcion === 'ADOPTADO' ? null : data.canilId === undefined ? animal.canilId : Number(data.canilId) || null;
    const cambio = destino !== animal.canilId;
    await bloquearCaniles(tx, animal.canilId, destino);
    if (cambio) await validarSalida(tx, animal.id);
    if (destino && cambio) {
      validarIngresoAnimal({ animal: { ...animal, ...updatePayload }, canil: await buscarCanil(tx, destino) });
    } else if (destino && updatePayload.especie && updatePayload.especie !== animal.especie) {
      validarEspeciesDelCanil({ ...animal, ...updatePayload }, await buscarCanil(tx, destino));
    }
    if (cambio) {
      updatePayload.canilId = destino;
      updatePayload.fechaIngresoCanil = destino ? new Date() : null;
      await registrarMovimiento(tx, animal, destino, user.id, 'Actualización de ficha');
    }
    const resultado = await tx.animal.update({ where: { id: animal.id }, data: updatePayload,
      include: { canil: true, creadoPor: { select: { id: true, nombre: true, rol: true } } } });
    if (cambio) {
      await sincronizarEstadoCanil(tx, animal.canilId);
      await sincronizarEstadoCanil(tx, destino);
    }
    return resultado;
  });

  const fichaActualizada = enriquecerFichaAnimal(actualizado);

  // Trazabilidad / Auditoría automática de modificación
  await registrarAuditoria({
    entidad: 'Animal',
    entidadId: actualizado.id,
    accion: 'MODIFICACION',
    valorAnterior: enriquecerFichaAnimal(actual),
    valorNuevo: fichaActualizada,
    usuario: user,
    ip
  });

  const notificacion = await notificarPersonalRefugio({
    tipo: 'ACTUALIZACION_ANIMAL',
    titulo: `Ficha del animal actualizada: ${actualizado.nombre}`,
    mensaje: `${user?.nombre || 'Miembro del equipo'} (${user?.rol || 'Staff'}) actualizó la ficha del animal ${actualizado.nombre}.`,
    destinatarios: ['DIRECCION', 'PERSONAL_VETERINARIO', 'PERSONAL_ADOPCIONES'],
    usuario: user,
    metadata: {
      animalId: actualizado.id,
      nombre: actualizado.nombre,
      estadoSalud: actualizado.estadoSalud
    }
  });

  return {
    ...fichaActualizada,
    notificacion
  };
};

export const deleteAnimal = async (id, user, ip) => {
  const animal = await prisma.animal.findUnique({
    where: { id: Number(id) },
    include: { canil: true }
  });
  if (!animal) throw new ErrorDominio(404, 'Animal no encontrado');

  // Baja lógica: no se borra físicamente
  const dadoDeBaja = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM animales WHERE id = ${Number(id)} FOR UPDATE`;
    const actual = await tx.animal.findUniqueOrThrow({ where: { id: Number(id) } });
    await bloquearCaniles(tx, actual.canilId);
    await tx.cuarentenaAnimal.updateMany({ where: { animalId: actual.id, estado: 'ACTIVA' }, data: { estado: 'INTERRUMPIDA', fechaFinReal: new Date() } });
    await registrarMovimiento(tx, actual, null, user.id, 'Baja de animal');
    const baja = await tx.animal.update({ where: { id: actual.id }, data: { activo: false, canilId: null, fechaIngresoCanil: null } });
    await sincronizarEstadoCanil(tx, actual.canilId);
    return baja;
  });

  await registrarAuditoria({
    entidad: 'Animal',
    entidadId: animal.id,
    accion: 'BAJA_LOGICA',
    valorAnterior: animal,
    valorNuevo: { activo: false },
    usuario: user,
    ip
  });

  return dadoDeBaja;
};
