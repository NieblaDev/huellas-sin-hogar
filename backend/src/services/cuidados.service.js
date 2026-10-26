import prisma from '../config/prisma.js';
import { registrarAuditoria } from './audit.service.js';

const ROLES_MEDICOS_AUTORIZADOS = ['VETERINARIA', 'DIRECTORA'];

const validarAnimalActivo = async (animalId) => {
  const animal = await prisma.animal.findUnique({
    where: { id: Number(animalId) },
    include: { canil: true }
  });
  if (!animal) throw new Error('Animal no encontrado');
  if (!animal.activo) {
    throw new Error(`El animal "${animal.nombre}" no cuenta con una ficha activa en el refugio`);
  }
  return animal;
};

// 1. REGISTRAR INDICACIÓN OPERATIVA O NOTA DE CUIDADO ESPECIAL
// Solo si existe ficha activa del animal y el usuario posee permisos médicos autorizados
export const crearIndicacion = async (data, user, ip) => {
  if (!ROLES_MEDICOS_AUTORIZADOS.includes(user?.rol)) {
    throw new Error('Acceso denegado: solo el personal con permisos médicos autorizados puede registrar indicaciones de cuidado');
  }

  const animal = await validarAnimalActivo(data.animalId);

  const indicacion = await prisma.indicacionCuidado.create({
    data: {
      animalId: animal.id,
      contexto: data.contexto,
      categoria: data.categoria,
      criticidad: data.criticidad,
      titulo: data.titulo,
      instruccion: data.instruccion,
      franjaHoraria: data.franjaHoraria,
      fechaInicio: new Date(data.fechaInicio),
      fechaFin: new Date(data.fechaFin),
      publicadaTurno: true, // Se publica automáticamente en el panel del turno
      creadoPorId: user.id
    },
    include: {
      animal: { select: { id: true, nombre: true, especie: true } },
      creadoPor: { select: { nombre: true, rol: true } }
    }
  });

  await registrarAuditoria({
    entidad: 'IndicacionCuidado',
    entidadId: indicacion.id,
    accion: 'CREACION',
    valorAnterior: null,
    valorNuevo: {
      animal: animal.nombre,
      contexto: indicacion.contexto,
      criticidad: indicacion.criticidad,
      titulo: indicacion.titulo,
      fechaInicio: indicacion.fechaInicio,
      fechaFin: indicacion.fechaFin
    },
    usuario: user,
    ip
  });

  return indicacion;
};

// 2. HISTORIAL DE INDICACIONES Y NOTAS DE CUIDADO POR ANIMAL
export const obtenerHistorialCuidadosAnimal = async (animalId) => {
  const animal = await validarAnimalActivo(animalId);

  const indicaciones = await prisma.indicacionCuidado.findMany({
    where: { animalId: animal.id, activo: true },
    include: {
      creadoPor: { select: { nombre: true, rol: true } },
      bitacoras: {
        orderBy: { fechaHora: 'desc' },
        take: 5,
        include: { voluntario: { select: { nombre: true, rol: true } } }
      }
    },
    orderBy: { creadoEn: 'desc' }
  });

  return { animal, indicaciones };
};

// 3. PANEL DE TAREAS DEL TURNO (PUBLICACIÓN AUTOMÁTICA SEGÚN FECHAS VIGENTES)
export const obtenerTareasTurno = async () => {
  const ahora = new Date();
  const hoyInicio = new Date(ahora);
  hoyInicio.setHours(0, 0, 0, 0);
  const hoyFin = new Date(ahora);
  hoyFin.setHours(23, 59, 59, 999);

  const indicacionesVigentes = await prisma.indicacionCuidado.findMany({
    where: {
      activo: true,
      publicadaTurno: true,
      animal: { activo: true },
      fechaInicio: { lte: hoyFin },
      fechaFin: { gte: hoyInicio }
    },
    include: {
      animal: {
        select: {
          id: true,
          nombre: true,
          especie: true,
          estadoSalud: true,
          canil: { select: { id: true, codigo: true, nombre: true, sector: true } }
        }
      },
      creadoPor: { select: { nombre: true, rol: true } },
      bitacoras: {
        where: { fechaHora: { gte: hoyInicio } },
        orderBy: { fechaHora: 'desc' },
        take: 1,
        include: { voluntario: { select: { nombre: true } } }
      }
    },
    orderBy: [
      { criticidad: 'asc' }, // CRITICA primero según orden del enum
      { creadoEn: 'desc' }
    ]
  });

  return indicacionesVigentes.map((item) => {
    const ultimoRegistroHoy = item.bitacoras[0] || null;
    return {
      id: item.id,
      contexto: item.contexto,
      categoria: item.categoria,
      criticidad: item.criticidad,
      titulo: item.titulo,
      instruccion: item.instruccion,
      franjaHoraria: item.franjaHoraria,
      fechaInicio: item.fechaInicio,
      fechaFin: item.fechaFin,
      emitidaPor: item.creadoPor?.nombre || 'Veterinaria',
      animal: item.animal,
      atendidoHoy: Boolean(ultimoRegistroHoy),
      detalleAtencion: ultimoRegistroHoy
        ? {
            por: ultimoRegistroHoy.voluntario.nombre,
            hora: ultimoRegistroHoy.fechaHora,
            observaciones: ultimoRegistroHoy.observaciones
          }
        : null
    };
  });
};

// 4. CUMPLIMIENTO DE TAREA POR VOLUNTARIOS EN BITÁCORA DEL TURNO
export const marcarIndicacionCompletada = async (data, user, ip) => {
  const indicacion = await prisma.indicacionCuidado.findUnique({
    where: { id: Number(data.indicacionId) },
    include: { animal: true }
  });

  if (!indicacion || !indicacion.activo) {
    throw new Error('La indicación de cuidado no existe o ya no está activa');
  }
  if (!indicacion.animal.activo) {
    throw new Error('El animal no tiene una ficha activa en el refugio');
  }
  if (!indicacion.publicadaTurno) {
    throw new Error('Esta indicación no está publicada en el panel de tareas del turno');
  }

  const registroBitacora = await prisma.bitacoraCuidado.create({
    data: {
      indicacionId: indicacion.id,
      voluntarioId: user.id,
      observaciones: data.observaciones || 'Cumplido durante la ronda del turno.',
      atencionEstado: 'COMPLETADO'
    },
    include: {
      voluntario: { select: { nombre: true, rol: true } }
    }
  });

  await registrarAuditoria({
    entidad: 'BitacoraCuidado',
    entidadId: registroBitacora.id,
    accion: 'CREACION',
    valorAnterior: null,
    valorNuevo: {
      animal: indicacion.animal.nombre,
      indicacion: indicacion.titulo,
      criticidad: indicacion.criticidad,
      voluntario: user.nombre
    },
    usuario: user,
    ip
  });

  return registroBitacora;
};