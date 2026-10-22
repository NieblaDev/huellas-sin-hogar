import prisma from '../config/prisma.js';
import { registrarAuditoria } from './audit.service.js';

// Regla de negocio: Validar que el animal exista y su ficha esté activa
const validarAnimalActivo = async (animalId) => {
  const animal = await prisma.animal.findUnique({
    where: { id: Number(animalId) },
    include: { canil: true }
  });
  if (!animal) throw new Error('Animal no encontrado');
  if (!animal.activo) throw new Error(`El animal "${animal.nombre}" no cuenta con ficha activa en el refugio`);
  return animal;
};

// 1. REGISTRAR VACUNA
export const registrarVacuna = async (data, user, ip) => {
  const animal = await validarAnimalActivo(data.animalId);

  const nuevaVacuna = await prisma.vacunaAnimal.create({
    data: {
      animalId: animal.id,
      nombreVacuna: data.nombreVacuna,
      dosis: data.dosis,
      lote: data.lote,
      fechaAplicacion: data.fechaAplicacion ? new Date(data.fechaAplicacion) : new Date(),
      fechaVencimiento: new Date(data.fechaVencimiento),
      veterinariaId: user.id,
      observaciones: data.observaciones
    }
  });

  await registrarAuditoria({
    entidad: 'VacunaAnimal',
    entidadId: nuevaVacuna.id,
    accion: 'CREACION',
    valorAnterior: null,
    valorNuevo: { ...nuevaVacuna, animal: animal.nombre },
    usuario: user,
    ip
  });

  return nuevaVacuna;
};

// 2. REGISTRAR ATENCIÓN CLÍNICA
export const registrarAtencionClinica = async (data, user, ip) => {
  const animal = await validarAnimalActivo(data.animalId);

  const atencion = await prisma.atencionClinica.create({
    data: {
      animalId: animal.id,
      veterinariaId: user.id,
      motivo: data.motivo,
      diagnostico: data.diagnostico,
      temperatura: data.temperatura ? Number(data.temperatura) : null,
      pesoActual: data.pesoActual ? Number(data.pesoActual) : null,
      tratamientos: data.tratamientos ? {
        create: data.tratamientos.map(t => ({
          animalId: animal.id,
          medicamento: t.medicamento,
          dosis: t.dosis,
          frecuenciaHoras: Number(t.frecuenciaHoras),
          fechaFin: new Date(t.fechaFin),
          indicacionesExtra: t.indicacionesExtra
        }))
      } : undefined,
      procedimientos: data.procedimientos ? {
        create: data.procedimientos.map(p => ({
          animalId: animal.id,
          tipo: p.tipo,
          descripcion: p.descripcion,
          resultado: p.resultado
        }))
      } : undefined
    },
    include: { tratamientos: true, procedimientos: true }
  });

  // Si se actualizó el peso durante la revisión médica, actualizar la ficha del animal
  if (data.pesoActual) {
    await prisma.animal.update({
      where: { id: animal.id },
      data: { peso: Number(data.pesoActual) }
    });
  }

  await registrarAuditoria({
    entidad: 'AtencionClinica',
    entidadId: atencion.id,
    accion: 'CREACION',
    valorAnterior: null,
    valorNuevo: { animal: animal.nombre, diagnostico: data.diagnostico },
    usuario: user,
    ip
  });

  return atencion;
};

// 3. REGISTRAR CUARENTENA Y ACTUALIZAR CANIL
export const registrarCuarentena = async (data, user, ip) => {
  const animal = await validarAnimalActivo(data.animalId);

  const cuarentena = await prisma.cuarentenaAnimal.create({
    data: {
      animalId: animal.id,
      motivo: data.motivo,
      canilAislamiento: data.canilAislamiento || (animal.canil ? animal.canil.codigo : null),
      fechaFinEstimada: new Date(data.fechaFinEstimada),
      observaciones: data.observaciones
    }
  });

  // Actualizar estado del canil si el animal está alojado en uno
  if (animal.canilId) {
    await prisma.canil.update({
      where: { id: animal.canilId },
      data: { estado: 'CUARENTENA' }
    });
  }

  // Marcar estado de salud del animal como CONDICION_ESPECIAL
  await prisma.animal.update({
    where: { id: animal.id },
    data: { estadoSalud: 'CONDICION_ESPECIAL' }
  });

  await registrarAuditoria({
    entidad: 'CuarentenaAnimal',
    entidadId: cuarentena.id,
    accion: 'CREACION',
    valorAnterior: null,
    valorNuevo: { animal: animal.nombre, motivo: data.motivo },
    usuario: user,
    ip
  });

  return cuarentena;
};

// 4. HISTORIAL CLÍNICO CONSOLIDADO POR ANIMAL
export const obtenerHistorialAnimal = async (animalId) => {
  const animal = await validarAnimalActivo(animalId);
  const [vacunas, atenciones, cuarentenas] = await Promise.all([
    prisma.vacunaAnimal.findMany({
      where: { animalId: animal.id, activo: true },
      orderBy: { fechaAplicacion: 'desc' }
    }),
    prisma.atencionClinica.findMany({
      where: { animalId: animal.id },
      include: {
        veterinaria: { select: { nombre: true, email: true } },
        tratamientos: true,
        procedimientos: true
      },
      orderBy: { fechaAtencion: 'desc' }
    }),
    prisma.cuarentenaAnimal.findMany({
      where: { animalId: animal.id },
      orderBy: { fechaInicio: 'desc' }
    })
  ]);
  return { animal, vacunas, atenciones, cuarentenas };
};

// 5. ALERTAS SANITARIAS DE VENCIMIENTO Y PENDIENTES
export const obtenerAlertasSanitarias = async () => {
  const ahora = new Date();
  const limite15Dias = new Date();
  limite15Dias.setDate(ahora.getDate() + 15);

  // 1. Consultar vacunas de animales con ficha activa
  const vacunas = await prisma.vacunaAnimal.findMany({
    where: { activo: true, animal: { activo: true } },
    include: {
      animal: { select: { id: true, nombre: true, especie: true, canil: true } }
    },
    orderBy: { fechaVencimiento: 'asc' }
  });

  // 2. Consultar tratamientos activos de animales con ficha activa
  const tratamientos = await prisma.tratamientoAnimal.findMany({
    where: { activo: true, animal: { activo: true } },
    include: {
      animal: { select: { id: true, nombre: true, especie: true, canil: true } }
    },
    orderBy: { fechaFin: 'asc' }
  });

  const vencidas = [];
  const proximas = [];
  const refuerzoRequerido = [];

  // Clasificar Vacunas
  for (const v of vacunas) {
    const fVenc = new Date(v.fechaVencimiento);
    const esRefuerzo = (v.dosis || '').toLowerCase().includes('refuerzo') || (v.nombreVacuna || '').toLowerCase().includes('refuerzo');

    if (fVenc < ahora) {
      vencidas.push({
        id: `vac-${v.id}`,
        tipo: 'VACUNA',
        titulo: v.nombreVacuna,
        subtitulo: v.dosis,
        fecha: v.fechaVencimiento,
        animal: v.animal,
        estadoAlerta: 'VENCIDO'
      });
      if (esRefuerzo) {
        refuerzoRequerido.push({
          id: `ref-${v.id}`,
          tipo: 'VACUNA',
          titulo: v.nombreVacuna,
          subtitulo: `Refuerzo sanitario pendiente (${v.dosis})`,
          fecha: v.fechaVencimiento,
          animal: v.animal,
          estadoAlerta: 'REFUERZO_REQUERIDO'
        });
      }
    } else if (fVenc <= limite15Dias) {
      if (esRefuerzo) {
        refuerzoRequerido.push({
          id: `ref-${v.id}`,
          tipo: 'VACUNA',
          titulo: v.nombreVacuna,
          subtitulo: `Refuerzo programado (${v.dosis})`,
          fecha: v.fechaVencimiento,
          animal: v.animal,
          estadoAlerta: 'REFUERZO_REQUERIDO'
        });
      } else {
        proximas.push({
          id: `vac-${v.id}`,
          tipo: 'VACUNA',
          titulo: v.nombreVacuna,
          subtitulo: v.dosis,
          fecha: v.fechaVencimiento,
          animal: v.animal,
          estadoAlerta: 'PROXIMO_A_VENCER'
        });
      }
    }
  }

  // Clasificar Tratamientos Médicos
  for (const t of tratamientos) {
    const fFin = new Date(t.fechaFin);
    if (fFin < ahora) {
      vencidas.push({
        id: `trat-${t.id}`,
        tipo: 'TRATAMIENTO',
        titulo: t.medicamento,
        subtitulo: `Dosis: ${t.dosis} (cada ${t.frecuenciaHoras}h)`,
        fecha: t.fechaFin,
        animal: t.animal,
        estadoAlerta: 'VENCIDO'
      });
    } else if (fFin <= limite15Dias) {
      proximas.push({
        id: `trat-${t.id}`,
        tipo: 'TRATAMIENTO',
        titulo: t.medicamento,
        subtitulo: `Finaliza tratamiento (${t.dosis})`,
        fecha: t.fechaFin,
        animal: t.animal,
        estadoAlerta: 'PROXIMO_A_VENCER'
      });
    }
  }

  return {
    resumen: {
      vencidasCount: vencidas.length,
      proximasCount: proximas.length,
      refuerzoCount: refuerzoRequerido.length,
      totalAlertas: vencidas.length + proximas.length + refuerzoRequerido.length
    },
    vencidas,
    proximas,
    refuerzoRequerido
  };
};