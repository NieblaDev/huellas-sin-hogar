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

export const getAllAnimals = async ({ especie, estadoSalud, search }) => {
  const where = { activo: true };
  if (especie) where.especie = { equals: especie, mode: 'insensitive' };
  if (estadoSalud) where.estadoSalud = estadoSalud;
  if (search) where.nombre = { contains: search, mode: 'insensitive' };

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
    orderBy: { creadoEn: 'desc' }
  });

  return lista.map(enriquecerFichaAnimal);
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
      adopciones: {
        orderBy: { fecha: 'desc' },
        include: {
          postulante: true
        }
      }
    }
  });

  if (!animal) throw new Error('Animal no encontrado');

  const ficha = enriquecerFichaAnimal(animal);
  const esDirectora = user?.rol === 'DIRECTORA';

  // Restricción de privacidad para roles distintos a Directora
  if (!esDirectora) {
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

  // Defensa adicional en servicio: especie ('Perro'|'Gato') y sexo ('Macho'|'Hembra') obligatorios
  const especieNorm = (animalData.especie || '').trim().toLowerCase();
  if (!['perro', 'gato'].includes(especieNorm)) {
    throw new Error("Validación estricta: Solo se permite el ingreso si la especie es canina ('perro') o felina ('gato')");
  }
  const sexoNorm = (animalData.sexo || '').trim().toLowerCase();
  if (!['macho', 'hembra'].includes(sexoNorm)) {
    throw new Error("Validación estricta: El sexo del animal debe estar definido ('macho' o 'hembra')");
  }

  const especieFinal = especieNorm === 'perro' ? 'Perro' : 'Gato';
  const sexoFinal = sexoNorm === 'macho' ? 'Macho' : 'Hembra';
  const causalIngreso = ['Rescate', 'Abandono', 'Decomiso'].includes(tipoIngreso) ? tipoIngreso : 'Rescate';

  // Si se asigna un canil inicial, comprobar disponibilidad
  let canilParaAsignar = null;
  if (canilId) {
    canilParaAsignar = await prisma.canil.findUnique({
      where: { id: Number(canilId) },
      include: { animalAlojado: true }
    });
    if (!canilParaAsignar) throw new Error('El canil especificado no existe');
    if (canilParaAsignar.animalAlojado) throw new Error(`El canil ${canilParaAsignar.nombre} ya está ocupado`);
  }

  const antecedenteClinico =
    (animalData.nota && animalData.nota.trim()) ||
    (historialMedico && historialMedico.trim()) ||
    'Sin antecedentes clínicos registrados al ingreso.';

  const notaConCausal = REGEX_TIPO_INGRESO.test(antecedenteClinico)
    ? antecedenteClinico
    : `[Ingreso por ${causalIngreso}] ${antecedenteClinico}`;

  // Flexibilidad de datos: antecedentes desconocidos se almacenan con valores seguros sin bloquear
  const newAnimal = await prisma.animal.create({
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
      canilId: canilId ? Number(canilId) : null,
      creadoPorId: user?.id || null
    },
    include: {
      canil: true,
      creadoPor: { select: { id: true, nombre: true, rol: true } }
    }
  });

  if (canilParaAsignar) {
    await prisma.canil.update({
      where: { id: canilParaAsignar.id },
      data: { estado: 'OCUPADO' }
    });

    // Registrar asignación inicial en traslados
    await prisma.traslado.create({
      data: {
        animalId: newAnimal.id,
        tipo: 'INTERNO_CANIL',
        motivo: `Asignación de canil en ingreso al refugio (${causalIngreso})`,
        estado: 'COMPLETADO',
        canilDestinoId: canilParaAsignar.id,
        responsableId: user.id
      }
    });
  }

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

  // Postcondición Requerimiento 1: Disparar notificación al personal del refugio
  const notificacion = await notificarPersonalRefugio({
    tipo: 'INGRESO_ANIMAL',
    titulo: `Nuevo ingreso por ${causalIngreso}: ${newAnimal.nombre} (${especieFinal})`,
    mensaje: `${user?.nombre || 'Miembro del equipo'} (${user?.rol || 'Staff'}) registró la ficha técnica de ${newAnimal.nombre} (${especieFinal}, ${sexoFinal}) ingresado por ${causalIngreso}. Estado inicial: ${newAnimal.estadoSalud}.`,
    destinatarios: ['DIRECTORA', 'VETERINARIA', 'ENCARGADA_ADOPCIONES'],
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
  const actual = await prisma.animal.findUnique({
    where: { id: Number(id) },
    include: { canil: true }
  });
  if (!actual) throw new Error('Animal no encontrado');

  const actualizado = await prisma.animal.update({
    where: { id: Number(id) },
    data,
    include: { canil: true }
  });

  // Trazabilidad / Auditoría automática de modificación
  await registrarAuditoria({
    entidad: 'Animal',
    entidadId: actualizado.id,
    accion: 'MODIFICACION',
    valorAnterior: actual,
    valorNuevo: actualizado,
    usuario: user,
    ip
  });

  return enriquecerFichaAnimal(actualizado);
};

export const deleteAnimal = async (id, user, ip) => {
  const animal = await prisma.animal.findUnique({
    where: { id: Number(id) },
    include: { canil: true }
  });
  if (!animal) throw new Error('Animal no encontrado');

  // Baja lógica: no se borra físicamente
  const dadoDeBaja = await prisma.animal.update({
    where: { id: Number(id) },
    data: { activo: false, canilId: null }
  });

  // Liberar el canil si tenía uno asignado
  if (animal.canilId) {
    await prisma.canil.update({
      where: { id: animal.canilId },
      data: { estado: 'LIBRE' }
    });
  }

  // Auditoría automática de baja lógica
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