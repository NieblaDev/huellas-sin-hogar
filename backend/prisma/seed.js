import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  // 1. Usuarios con distintos roles para probar permisos
  const directora = await prisma.usuario.upsert({
    where: { email: 'directora@huellas.cl' },
    update: { nombre: 'Valentina Directora', rol: 'DIRECTORA' },
    create: {
      email: 'directora@huellas.cl',
      password: hashedPassword,
      nombre: 'Valentina Directora',
      rol: 'DIRECTORA'
    }
  });

  const veterinaria = await prisma.usuario.upsert({
    where: { email: 'veterinaria@huellas.cl' },
    update: { nombre: 'Dra. Elena Ruiz', rol: 'VETERINARIA' },
    create: {
      email: 'veterinaria@huellas.cl',
      password: hashedPassword,
      nombre: 'Dra. Elena Ruiz',
      rol: 'VETERINARIA'
    }
  });

  const voluntarioAvanzado = await prisma.usuario.upsert({
    where: { email: 'voluntario.avanzado@huellas.cl' },
    update: { nombre: 'Andrés Mendoza (Avanzado)', rol: 'VOLUNTARIO_AVANZADO' },
    create: {
      email: 'voluntario.avanzado@huellas.cl',
      password: hashedPassword,
      nombre: 'Andrés Mendoza (Avanzado)',
      rol: 'VOLUNTARIO_AVANZADO'
    }
  });

  const voluntarioNovato = await prisma.usuario.upsert({
    where: { email: 'voluntario@huellas.cl' },
    update: { nombre: 'Lucas Silva (Voluntario)', rol: 'VOLUNTARIO_NOVATO' },
    create: {
      email: 'voluntario@huellas.cl',
      password: hashedPassword,
      nombre: 'Lucas Silva (Voluntario)',
      rol: 'VOLUNTARIO_NOVATO'
    }
  });

  // Mantener compatibilidad con staff@huellas.cl
  await prisma.usuario.upsert({
    where: { email: 'staff@huellas.cl' },
    update: { nombre: 'Admin General', rol: 'DIRECTORA' },
    create: {
      email: 'staff@huellas.cl',
      password: hashedPassword,
      nombre: 'Admin General',
      rol: 'DIRECTORA'
    }
  });

  // 2. Caniles (10 caniles universales por defecto al cargar el sistema)
  const canilesData = [];
  for (let i = 1; i <= 10; i++) {
    canilesData.push({
      codigo: `C-${i < 10 ? '0' + i : i}`,
      nombre: `Canil ${i}`,
      sector: i % 4 === 0 ? 'Cuarentena' : 'Patio Principal',
      tipo: 'General',
      capacidad: 1,
      estado: 'LIBRE'
    });
  }

  for (const c of canilesData) {
    await prisma.canil.upsert({
      where: { codigo: c.codigo },
      update: {},
      create: c
    });
  }

  // 3. Animales
  const animalesRaw = [
    { nombre: 'Mochi', especie: 'Gato', sexo: 'Hembra', edad: '3 años', raza: 'Mestizo', peso: 4.1, estadoSalud: 'NORMAL', nota: 'Vacunas al día. Lista para adopción.', esterilizacion: 'SÍ (Operada)', comportamiento: 'Tranquila, cariñosa', creadoPorId: directora.id },
    { nombre: 'Rocky', especie: 'Perro', sexo: 'Macho', edad: '2 años', raza: 'Labrador', peso: 26.5, chip: 'ES-4471120', estadoSalud: 'CONDICION_ESPECIAL', nota: 'Dieta blanda por 5 días. No puede correr.', esterilizacion: 'NO', comportamiento: 'Activo, en recuperación', creadoPorId: veterinaria.id },
    { nombre: 'Luna', especie: 'Perro', sexo: 'Hembra', edad: '1.5 años', raza: 'Mestizo', peso: 14.5, chip: 'ES-9831122', estadoSalud: 'NORMAL', nota: 'Sin novedad.', esterilizacion: 'SÍ (Operada)', comportamiento: 'Sociable, dócil, activa', creadoPorId: voluntarioAvanzado.id },
    { nombre: 'Bruno', especie: 'Perro', sexo: 'Macho', edad: '5 años', raza: 'Mestizo', peso: 22.0, chip: 'ES-1120987', estadoSalud: 'NORMAL', nota: 'Sin novedad. Paseos normales.', esterilizacion: 'SÍ (Operado)', comportamiento: 'Calmado, obediente', creadoPorId: voluntarioAvanzado.id },
    { nombre: 'Nala', especie: 'Gato', sexo: 'Hembra', edad: '4 meses', raza: 'Mestizo', peso: 1.8, estadoSalud: 'CONDICION_ESPECIAL', nota: 'En observación médica.', esterilizacion: 'NO', comportamiento: 'Tímida, en observación', creadoPorId: veterinaria.id },
    { nombre: 'Thor', especie: 'Perro', sexo: 'Macho', edad: '3 años', raza: 'Husky', peso: 24.0, chip: 'ES-7743201', estadoSalud: 'NORMAL', nota: 'Energético. Requiere paseos largos.', esterilizacion: 'SÍ (Operado)', comportamiento: 'Enérgico, paseos largos', creadoPorId: voluntarioNovato.id },
    { nombre: 'Simba', especie: 'Gato', sexo: 'Macho', edad: '6 años', raza: 'Naranja', peso: 5.2, estadoSalud: 'NORMAL', nota: 'Ideal para departamento.', esterilizacion: 'SÍ (Operado)', comportamiento: 'Muy tranquilo', creadoPorId: voluntarioNovato.id },
    { nombre: 'Canela', especie: 'Perro', sexo: 'Hembra', edad: '2 años', raza: 'Cocker', peso: 12.0, chip: 'ES-5528834', estadoSalud: 'CRITICO', nota: 'Tratamiento antibiótico estricto.', esterilizacion: 'NO', comportamiento: 'En recuperación delicada', creadoPorId: veterinaria.id },
    { nombre: 'Oreo', especie: 'Gato', sexo: 'Macho', edad: '1 año', raza: 'Mestizo', peso: 3.6, estadoSalud: 'NORMAL', nota: 'Juguetón sin restricciones.', esterilizacion: 'NO', comportamiento: 'Juguetón', creadoPorId: voluntarioNovato.id },
    { nombre: 'Perla', especie: 'Perro', sexo: 'Hembra', edad: '7 años', raza: 'Poodle', peso: 9.4, chip: 'ES-3341556', estadoSalud: 'CONDICION_ESPECIAL', nota: 'Medicación para artritis cada 12h.', esterilizacion: 'SÍ (Operada)', comportamiento: 'Tranquila, medicada', creadoPorId: veterinaria.id },
  ];

  for (const an of animalesRaw) {
    const existing = await prisma.animal.findFirst({ where: { nombre: an.nombre } });
    if (!existing) {
      await prisma.animal.create({ data: an });
    }
  }

  // 4. Asignar algunos caniles a animales
  const canilesList = await prisma.canil.findMany({ orderBy: { id: 'asc' } });
  const animalesList = await prisma.animal.findMany({ orderBy: { id: 'asc' } });

  // Asignamos 4 caniles para tener ocupación inicial
  if (canilesList.length >= 4 && animalesList.length >= 4) {
    await prisma.animal.update({
      where: { id: animalesList[1].id }, // Rocky
      data: { canilId: canilesList[0].id }
    });
    await prisma.canil.update({
      where: { id: canilesList[0].id },
      data: { estado: 'OCUPADO' }
    });

    await prisma.animal.update({
      where: { id: animalesList[3].id }, // Bruno
      data: { canilId: canilesList[1].id }
    });
    await prisma.canil.update({
      where: { id: canilesList[1].id },
      data: { estado: 'OCUPADO' }
    });

    await prisma.animal.update({
      where: { id: animalesList[4].id }, // Nala
      data: { canilId: canilesList[3].id }
    });
    await prisma.canil.update({
      where: { id: canilesList[3].id },
      data: { estado: 'CUARENTENA' }
    });
  }

  // 5. Insumos con stocks críticos, unidades, vencimientos y clasificación de fármacos
  const fechaHoy = new Date();
  const fechaVencePronto = new Date(fechaHoy.getTime() + 15 * 24 * 3600 * 1000); // en 15 días (alerta)
  const fechaVenceLejos = new Date(fechaHoy.getTime() + 180 * 24 * 3600 * 1000); // en 6 meses

  const insumos = [
    { nombre: 'Alimento seco perros 15kg', categoria: 'Alimento', stock: 18, stockMinimo: 10, unidad: 'Sacos', esFarmaco: false, ubicacion: 'Bodega Central', fechaVencimiento: fechaVenceLejos, lote: 'LOT-ALM-2026' },
    { nombre: 'Alimento húmedo gatos', categoria: 'Alimento', stock: 4, stockMinimo: 12, unidad: 'Latas', esFarmaco: false, ubicacion: 'Cocina Gatera', fechaVencimiento: fechaVencePronto, lote: 'LOT-FEL-991' }, // Crítico y por vencer
    { nombre: 'Amoxicilina 250mg', categoria: 'Medicamento', stock: 25, stockMinimo: 15, unidad: 'Cajas', esFarmaco: true, ubicacion: 'Farmacia Clínica', fechaVencimiento: fechaVencePronto, lote: 'MED-AMX-044' }, // Fármaco por vencer
    { nombre: 'Ivermectina pipetas', categoria: 'Medicamento', stock: 2, stockMinimo: 8, unidad: 'Pipetas', esFarmaco: true, ubicacion: 'Farmacia Clínica', fechaVencimiento: fechaVenceLejos, lote: 'MED-IVR-112' }, // Fármaco Crítico
    { nombre: 'Desinfectante caniles 5L', categoria: 'Higiene', stock: 3, stockMinimo: 6, unidad: 'Bidones', esFarmaco: false, ubicacion: 'Patio Limpieza', fechaVencimiento: fechaVenceLejos, lote: 'HIG-DES-301' }, // Crítico
    { nombre: 'Vendas elásticas', categoria: 'Higiene', stock: 15, stockMinimo: 5, unidad: 'Unidades', esFarmaco: false, ubicacion: 'Botiquín Primeros Auxilios', fechaVencimiento: fechaVenceLejos, lote: 'HIG-VEN-009' },
    { nombre: 'Meloxicam Gotas 10ml', categoria: 'Medicamento', stock: 8, stockMinimo: 4, unidad: 'Frascos', esFarmaco: true, ubicacion: 'Farmacia Clínica', fechaVencimiento: fechaVenceLejos, lote: 'MED-MLX-770' }
  ];

  const insumosCreados = [];
  for (const ins of insumos) {
    let item = await prisma.insumo.findFirst({ where: { nombre: ins.nombre } });
    if (!item) {
      item = await prisma.insumo.create({ data: ins });
    } else {
      item = await prisma.insumo.update({
        where: { id: item.id },
        data: {
          unidad: ins.unidad,
          esFarmaco: ins.esFarmaco,
          ubicacion: ins.ubicacion,
          fechaVencimiento: ins.fechaVencimiento,
          lote: ins.lote
        }
      });
    }
    insumosCreados.push(item);
  }

  // 5.1 Movimientos clasificados de inventario iniciales
  const primerInsumo = insumosCreados[0];
  const amoxicilina = insumosCreados.find(i => i.nombre.includes('Amoxicilina'));
  const canelaAnimal = await prisma.animal.findFirst({ where: { nombre: 'Canela' } });

  if (primerInsumo) {
    const movExistente = await prisma.movimientoInventario.findFirst({ where: { insumoId: primerInsumo.id } });
    if (!movExistente) {
      await prisma.movimientoInventario.create({
        data: {
          insumoId: primerInsumo.id,
          tipo: 'ENTRADA',
          subtipo: 'DONACION',
          cantidad: 18,
          stockAnterior: 0,
          stockNuevo: 18,
          motivo: 'Donación masiva de alimento por campaña solidaria comunitaria',
          donanteOProveedor: 'Fundación Huellitas Amigas',
          registradoPorId: directora.id
        }
      });
    }
  }

  if (amoxicilina && canelaAnimal) {
    const movMed = await prisma.movimientoInventario.findFirst({ where: { insumoId: amoxicilina.id, animalId: canelaAnimal.id } });
    if (!movMed) {
      await prisma.movimientoInventario.create({
        data: {
          insumoId: amoxicilina.id,
          tipo: 'SALIDA',
          subtipo: 'TRATAMIENTO_MEDICO',
          cantidad: 2,
          stockAnterior: 27,
          stockNuevo: 25,
          motivo: 'Antibiótico administrado para control infeccioso post-quirúrgico',
          animalId: canelaAnimal.id,
          lote: 'MED-AMX-044',
          registradoPorId: veterinaria.id
        }
      });
    }
  }

  // 6. Postulantes para adopción
  const postulantes = [
    { nombre: 'Ana González', rut: '12.345.678-9', telefono: '+56 9 8877 6655', email: 'ana@gmail.com' },
    { nombre: 'Carlos Pérez', rut: '9.876.543-2', telefono: '+56 9 7766 5544', email: 'carlos@gmail.com' },
    { nombre: 'María López', rut: '15.111.222-3', telefono: '+56 9 6655 4433', email: 'maria@gmail.com' }
  ];

  for (const post of postulantes) {
    await prisma.postulante.upsert({
      where: { rut: post.rut },
      update: {},
      create: post
    });
  }

  // 7. Turnos estructurados (con tareas críticas, planificación confirmada y turnos descubiertos)
  const turnos = [
    { diaSemana: 'Lunes', franja: 'Mañana', area: 'Paseos', voluntario: 'Andrés Mendoza', cubierto: true, esCritica: false, cupoMaximo: 2, estadoPlanificacion: 'CONFIRMADA', horaInicio: '08:00', horaFin: '13:00' },
    { diaSemana: 'Lunes', franja: 'Tarde', area: 'Atención Veterinaria', voluntario: 'Andrés Mendoza (Avanzado)', cubierto: true, esCritica: true, cupoMaximo: 1, estadoPlanificacion: 'CONFIRMADA', horaInicio: '14:00', horaFin: '19:00' },
    { diaSemana: 'Martes', franja: 'Mañana', area: 'Limpieza', voluntario: 'Lucas Silva', cubierto: true, esCritica: false, cupoMaximo: 3, estadoPlanificacion: 'CONFIRMADA', horaInicio: '08:00', horaFin: '13:00' },
    { diaSemana: 'Martes', franja: 'Tarde', area: 'Paseos', voluntario: null, cubierto: false, esCritica: false, cupoMaximo: 2, estadoPlanificacion: 'CONFIRMADA', horaInicio: '14:00', horaFin: '19:00' }, // Descubierto
    { diaSemana: 'Miércoles', franja: 'Mañana', area: 'Alimentación', voluntario: 'Lucas Silva', cubierto: true, esCritica: false, cupoMaximo: 2, estadoPlanificacion: 'CONFIRMADA', horaInicio: '08:00', horaFin: '13:00' },
    { diaSemana: 'Miércoles', franja: 'Tarde', area: 'Atención Veterinaria', voluntario: null, cubierto: false, esCritica: true, cupoMaximo: 1, estadoPlanificacion: 'CONFIRMADA', horaInicio: '14:00', horaFin: '19:00' }, // Descubierto Crítico
    { diaSemana: 'Jueves', franja: 'Mañana', area: 'Paseos', voluntario: null, cubierto: false, esCritica: false, cupoMaximo: 2, estadoPlanificacion: 'CONFIRMADA', horaInicio: '08:00', horaFin: '13:00' }, // Descubierto
    { diaSemana: 'Viernes', franja: 'Mañana', area: 'Limpieza', voluntario: 'Lucas Silva', cubierto: true, esCritica: false, cupoMaximo: 2, estadoPlanificacion: 'CONFIRMADA', horaInicio: '08:00', horaFin: '13:00' },
    { diaSemana: 'Sábado', franja: 'Mañana', area: 'Paseos y Socialización', voluntario: null, cubierto: false, esCritica: false, cupoMaximo: 4, estadoPlanificacion: 'CONFIRMADA', horaInicio: '09:00', horaFin: '14:00' }
  ];

  const turnosCreados = [];
  for (const t of turnos) {
    let ex = await prisma.turno.findFirst({ where: { diaSemana: t.diaSemana, franja: t.franja, area: t.area } });
    if (!ex) {
      ex = await prisma.turno.create({ data: t });
    } else {
      ex = await prisma.turno.update({
        where: { id: ex.id },
        data: {
          esCritica: t.esCritica,
          cupoMaximo: t.cupoMaximo,
          estadoPlanificacion: t.estadoPlanificacion,
          horaInicio: t.horaInicio,
          horaFin: t.horaFin
        }
      });
    }
    turnosCreados.push(ex);
  }

  // 7.1 Inscripciones individuales previas obligatorias
  const turnoLunesPaseos = turnosCreados.find(t => t.diaSemana === 'Lunes' && t.area === 'Paseos');
  const turnoLunesVet = turnosCreados.find(t => t.diaSemana === 'Lunes' && t.area === 'Atención Veterinaria');
  const turnoMartesLimp = turnosCreados.find(t => t.diaSemana === 'Martes' && t.area === 'Limpieza');

  if (turnoLunesVet) {
    const inscripcionVet = await prisma.inscripcionTurno.findFirst({ where: { turnoId: turnoLunesVet.id, usuarioId: voluntarioAvanzado.id } });
    if (!inscripcionVet) {
      await prisma.inscripcionTurno.create({
        data: {
          turnoId: turnoLunesVet.id,
          usuarioId: voluntarioAvanzado.id,
          estado: 'CONFIRMADA'
        }
      });
    }
  }

  if (turnoMartesLimp) {
    const inscripcionNov = await prisma.inscripcionTurno.findFirst({ where: { turnoId: turnoMartesLimp.id, usuarioId: voluntarioNovato.id } });
    if (!inscripcionNov) {
      await prisma.inscripcionTurno.create({
        data: {
          turnoId: turnoMartesLimp.id,
          usuarioId: voluntarioNovato.id,
          estado: 'CONFIRMADA',
          asistenciaRegistrada: true
        }
      });

      // 7.2 Bitácora de turno habilitada
      const bitacoraExistente = await prisma.bitacoraTurno.findFirst({ where: { turnoId: turnoMartesLimp.id, usuarioId: voluntarioNovato.id } });
      if (!bitacoraExistente) {
        await prisma.bitacoraTurno.create({
          data: {
            turnoId: turnoMartesLimp.id,
            usuarioId: voluntarioNovato.id,
            tareasRealizadas: 'Limpieza y sanitización de caniles del sector A. Reposición de agua fresca y mantas limpias.',
            incidentes: 'Sin novedades. Todos los animales se comportaron tranquilos.',
            observaciones: 'Se utilizó desinfectante según protocolo del refugio.'
          }
        });
      }
    }
  }

  // 7.3 Permuta de ejemplo solicitada y pendiente de validación por ambas partes
  if (turnoLunesPaseos && turnoMartesLimp) {
    const permutaEx = await prisma.permutaTurno.findFirst({
      where: { solicitanteId: voluntarioNovato.id, destinatarioId: voluntarioAvanzado.id }
    });
    if (!permutaEx) {
      await prisma.permutaTurno.create({
        data: {
          solicitanteId: voluntarioNovato.id,
          destinatarioId: voluntarioAvanzado.id,
          turnoOrigenId: turnoMartesLimp.id,
          turnoDestinoId: turnoLunesPaseos.id,
          motivo: 'Compromiso académico en la universidad el martes en la mañana; solicito permuta con turno de lunes.',
          aprobadoSolicitante: true,
          aprobadoDestinatario: false, // Esperando aprobación de Andrés (destinatario)
          estado: 'PENDIENTE'
        }
      });
    }
  }

  // 8. Registro inicial de Auditoría
  await prisma.auditoria.create({
    data: {
      entidad: 'Sistema',
      entidadId: 1,
      accion: 'CREACION',
      valorAnterior: null,
      valorNuevo: { descripcion: 'Inicialización de datos del refugio' },
      usuarioId: directora.id,
      usuarioEmail: directora.email,
      usuarioNombre: directora.nombre
    }
  });

  console.log('Seed completo ejecutado con éxito para Huellas Sin Hogar.');
}

main().catch(console.error).finally(() => prisma.$disconnect());