import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DIA = 24 * 60 * 60 * 1000;
const ahora = new Date();
const hace = dias => new Date(ahora.getTime() - dias * DIA);
const en = dias => new Date(ahora.getTime() + dias * DIA);
const reiniciarTodo = process.argv.includes('--reset') || process.env.SEED_RESET === '1';

const autorDe = (usuarios, clave) => {
  const usuario = usuarios[clave] ?? usuarios.directora;
  return { usuarioId: usuario.id, usuarioEmail: usuario.email, usuarioNombre: usuario.nombre };
};

// Inserta el registro solo si no existe una coincidencia con la clave natural indicada.
const asegurar = async (modelo, where, data) => {
  const existente = await prisma[modelo].findFirst({ where });
  return existente ?? prisma[modelo].create({ data });
};

// Auditoría idempotente: la marca "seed" dentro de valorNuevo identifica cada evento.
const auditar = async (marca, datos) => {
  const existente = await prisma.auditoria.findFirst({
    where: { valorNuevo: { path: ['seed'], equals: marca } }
  });
  if (existente) return existente;
  const { valorNuevo, ...resto } = datos;
  return prisma.auditoria.create({ data: { ...resto, valorNuevo: { seed: marca, ...(valorNuevo ?? {}) } } });
};

async function reiniciar() {
  console.log('SEED_RESET activo: eliminando datos existentes (se conserva el esquema)...');
  await prisma.$transaction([
    prisma.lecturaNotificacion.deleteMany(),
    prisma.intentoSeguimiento.deleteMany(),
    prisma.seguimientoAdopcion.deleteMany(),
    prisma.devolucion.deleteMany(),
    prisma.adopcion.deleteMany(),
    prisma.etapaSolicitudAdopcion.deleteMany(),
    prisma.solicitudAdopcion.deleteMany(),
    prisma.movimientoInventario.deleteMany(),
    prisma.tratamientoAnimal.deleteMany(),
    prisma.procedimientoAnimal.deleteMany(),
    prisma.atencionClinica.deleteMany(),
    prisma.vacunaAnimal.deleteMany(),
    prisma.bitacoraCuidado.deleteMany(),
    prisma.indicacionCuidado.deleteMany(),
    prisma.cuarentenaAnimal.deleteMany(),
    prisma.traslado.deleteMany(),
    prisma.bitacoraTurno.deleteMany(),
    prisma.permutaTurno.deleteMany(),
    prisma.inscripcionTurno.deleteMany(),
    prisma.turno.deleteMany(),
    prisma.animal.deleteMany(),
    prisma.insumo.deleteMany(),
    prisma.postulante.deleteMany(),
    prisma.canil.deleteMany(),
    prisma.configuracionSistema.deleteMany(),
    prisma.auditoria.deleteMany(),
    prisma.usuario.deleteMany()
  ]);
}

async function sembrarUsuarios(hashedPassword) {
  const datos = [
    { clave: 'directora', email: 'directora@huellas.cl', nombre: 'Valentina Directora', rol: 'DIRECCION', sexo: 'FEMENINO' },
    { clave: 'staff', email: 'staff@huellas.cl', nombre: 'Admin General', rol: 'DIRECCION', sexo: 'NEUTRO' },
    { clave: 'veterinaria', email: 'veterinaria@huellas.cl', nombre: 'Dra. Elena Ruiz', rol: 'PERSONAL_VETERINARIO', sexo: 'FEMENINO' },
    { clave: 'veterinario2', email: 'veterinario2@huellas.cl', nombre: 'Dr. Marcos Araya', rol: 'PERSONAL_VETERINARIO', sexo: 'MASCULINO' },
    { clave: 'adopciones', email: 'adopciones@huellas.cl', nombre: 'Encargada de adopciones', rol: 'PERSONAL_ADOPCIONES', sexo: 'FEMENINO' },
    { clave: 'adopciones2', email: 'adopciones2@huellas.cl', nombre: 'Coordinador de adopciones', rol: 'PERSONAL_ADOPCIONES', sexo: 'NEUTRO' },
    { clave: 'avanzado', email: 'voluntario.avanzado@huellas.cl', nombre: 'Andrés Mendoza (Avanzado)', rol: 'VOLUNTARIO_AVANZADO', sexo: 'MASCULINO' },
    { clave: 'novato', email: 'voluntario@huellas.cl', nombre: 'Lucas Silva (Voluntario)', rol: 'VOLUNTARIO_NOVATO', sexo: 'MASCULINO' },
    { clave: 'novata', email: 'voluntaria@huellas.cl', nombre: 'Josefa Rivas (Voluntaria)', rol: 'VOLUNTARIO_NOVATO', sexo: 'FEMENINO' }
  ];

  const usuarios = {};
  for (const u of datos) {
    usuarios[u.clave] = await prisma.usuario.upsert({
      where: { email: u.email },
      update: { nombre: u.nombre, rol: u.rol, sexo: u.sexo, password: hashedPassword },
      create: { email: u.email, password: hashedPassword, nombre: u.nombre, rol: u.rol, sexo: u.sexo }
    });
  }

  // Garantiza que todas las cuentas existentes queden con la contraseña de prueba.
  await prisma.usuario.updateMany({ data: { password: hashedPassword } });

  return usuarios;
}

async function sembrarCaniles() {
  // Todos los caniles se nombran exclusivamente "Canil <número>".
  const base = [];
  for (let i = 1; i <= 20; i++) {
    base.push({
      codigo: `C-${String(i).padStart(2, '0')}`,
      nombre: `Canil ${i}`,
      sector: 'Patio Principal',
      tipo: 'Mixto',
      capacidad: 1
    });
  }
  const nuevos = [
    { codigo: 'C-21', nombre: 'Canil 21', sector: 'Patio Principal', tipo: 'Perro', capacidad: 7 },
    { codigo: 'C-22', nombre: 'Canil 22', sector: 'Gatera', tipo: 'Gato', capacidad: 5 },
    { codigo: 'C-23', nombre: 'Canil 23', sector: 'Gatera', tipo: 'Mixto', capacidad: 2 },
    { codigo: 'C-24', nombre: 'Canil 24', sector: 'Cuarentena', tipo: 'Mixto', capacidad: 1, estado: 'MANTENIMIENTO' },
    { codigo: 'C-25', nombre: 'Canil 25', sector: 'Cuarentena', tipo: 'Mixto', capacidad: 1 }
  ];

  const caniles = {};
  for (const c of base) {
    caniles[c.codigo] = await prisma.canil.upsert({ where: { codigo: c.codigo }, update: {}, create: c });
  }
  for (const c of nuevos) {
    caniles[c.codigo] = await prisma.canil.upsert({
      where: { codigo: c.codigo },
      update: { nombre: c.nombre, sector: c.sector, tipo: c.tipo, capacidad: c.capacidad, ...(c.estado ? { estado: c.estado } : {}) },
      create: c
    });
  }
  return { caniles, nuevos };
}

async function sembrarAnimales(usuarios) {
  const datos = [
    // Fichas base del refugio
    { nombre: 'Mochi', especie: 'Gato', sexo: 'Hembra', edad: '3 años', raza: 'Mestizo', peso: 4.1, estadoSalud: 'NORMAL', nota: 'Vacunas al día. Lista para adopción.', esterilizacion: 'SÍ (Operada)', comportamiento: 'Tranquila, cariñosa', creadoPor: 'directora' },
    { nombre: 'Rocky', especie: 'Perro', sexo: 'Macho', edad: '2 años', raza: 'Labrador', peso: 26.5, chip: 'ES-4471120', estadoSalud: 'ESPECIAL', nota: 'Dieta blanda por 5 días. No puede correr.', esterilizacion: 'NO', comportamiento: 'Activo, en recuperación', creadoPor: 'veterinaria' },
    { nombre: 'Luna', especie: 'Perro', sexo: 'Hembra', edad: '1.5 años', raza: 'Mestizo', peso: 14.5, chip: 'ES-9831122', estadoSalud: 'NORMAL', nota: 'Sin novedad.', esterilizacion: 'SÍ (Operada)', comportamiento: 'Sociable, dócil, activa', creadoPor: 'avanzado' },
    { nombre: 'Bruno', especie: 'Perro', sexo: 'Macho', edad: '5 años', raza: 'Mestizo', peso: 22.0, chip: 'ES-1120987', estadoSalud: 'NORMAL', nota: 'Sin novedad. Paseos normales.', esterilizacion: 'SÍ (Operado)', comportamiento: 'Calmado, obediente', creadoPor: 'avanzado' },
    { nombre: 'Nala', especie: 'Gato', sexo: 'Hembra', edad: '4 meses', raza: 'Mestizo', peso: 1.8, estadoSalud: 'ESPECIAL', nota: 'En observación médica y adaptación.', esterilizacion: 'NO', comportamiento: 'Tímida, en observación', creadoPor: 'veterinaria' },
    { nombre: 'Thor', especie: 'Perro', sexo: 'Macho', edad: '3 años', raza: 'Husky', peso: 24.0, chip: 'ES-7743201', estadoSalud: 'NORMAL', nota: 'Energético. Requiere paseos largos.', esterilizacion: 'SÍ (Operado)', comportamiento: 'Enérgico, paseos largos', creadoPor: 'novato' },
    { nombre: 'Simba', especie: 'Gato', sexo: 'Macho', edad: '6 años', raza: 'Naranja', peso: 5.2, estadoSalud: 'NORMAL', nota: 'Ideal para departamento.', esterilizacion: 'SÍ (Operado)', comportamiento: 'Muy tranquilo', creadoPor: 'novato' },
    { nombre: 'Canela', especie: 'Perro', sexo: 'Hembra', edad: '2 años', raza: 'Cocker', peso: 12.0, chip: 'ES-5528834', estadoSalud: 'CRITICO', nota: 'Tratamiento antibiótico estricto.', esterilizacion: 'NO', comportamiento: 'En recuperación delicada', creadoPor: 'veterinaria' },
    { nombre: 'Oreo', especie: 'Gato', sexo: 'Macho', edad: '1 año', raza: 'Mestizo', peso: 3.6, estadoSalud: 'NORMAL', nota: 'Juguetón sin restricciones.', esterilizacion: 'NO', comportamiento: 'Juguetón', creadoPor: 'novato' },
    { nombre: 'Perla', especie: 'Perro', sexo: 'Hembra', edad: '7 años', raza: 'Poodle', peso: 9.4, chip: 'ES-3341556', estadoSalud: 'ESPECIAL', nota: 'Medicación para artritis cada 12h.', esterilizacion: 'SÍ (Operada)', comportamiento: 'Tranquila, medicada', creadoPor: 'veterinaria' },

    // Fichas con seguimiento clínico y de cuidados
    { nombre: 'Toby', especie: 'Perro', sexo: 'Macho', edad: '2 años', raza: 'Mestizo', peso: 12.5, chip: 'CL-100001', estadoSalud: 'ESPECIAL', nota: 'Esguince leve en miembro posterior; reposo y analgesia.', esterilizacion: 'SÍ (Operado)', comportamiento: 'Dócil, colaborador', creadoPor: 'veterinaria' },
    { nombre: 'Kiara', especie: 'Perro', sexo: 'Hembra', edad: '3 años', raza: 'Mestizo', peso: 9.8, chip: 'CL-100002', estadoSalud: 'ESPECIAL', nota: 'Dermatitis alérgica en tratamiento y curaciones diarias.', esterilizacion: 'SÍ (Operada)', comportamiento: 'Nerviosa con extraños', creadoPor: 'veterinario2' },
    { nombre: 'Chocolate', especie: 'Perro', sexo: 'Macho', edad: '1 año', raza: 'Mestizo', peso: 15.3, chip: 'CL-100003', estadoSalud: 'NORMAL', nota: 'Post operatorio de esterilización sin complicaciones.', esterilizacion: 'SÍ (Operado)', comportamiento: 'Juguetón y sociable', creadoPor: 'veterinaria' },
    { nombre: 'Pelusa', especie: 'Gato', sexo: 'Hembra', edad: '8 años', raza: 'Siamés', peso: 4.2, estadoSalud: 'ESPECIAL', nota: 'Artrosis leve; analgesia diaria y control de peso.', esterilizacion: 'SÍ (Operada)', comportamiento: 'Tranquila, independiente', creadoPor: 'veterinaria' },
    { nombre: 'Bingo', especie: 'Perro', sexo: 'Macho', edad: '4 años', raza: 'Mestizo', peso: 11.2, chip: 'CL-100004', estadoSalud: 'ESPECIAL', nota: 'Traqueobronquitis en tratamiento antibiótico.', esterilizacion: 'SÍ (Operado)', comportamiento: 'Tranquilo, tos ocasional', creadoPor: 'veterinario2' },
    { nombre: 'Coco', especie: 'Gato', sexo: 'Macho', edad: '2 años', raza: 'Naranja', peso: 4.8, estadoSalud: 'NORMAL', nota: 'Estrés por entorno; se evalúa hogar temporal.', esterilizacion: 'SÍ (Operado)', comportamiento: 'Tímido, se esconde', creadoPor: 'adopciones' },
    { nombre: 'Fiona', especie: 'Perro', sexo: 'Hembra', edad: '5 años', raza: 'Poodle', peso: 7.6, chip: 'CL-100005', estadoSalud: 'NORMAL', nota: 'Requiere peluquería periódica y paseos cortos.', esterilizacion: 'SÍ (Operada)', comportamiento: 'Cariñosa, tranquila', creadoPor: 'novata' },

    // Animales con proceso de adopción
    { nombre: 'Nube', especie: 'Gato', sexo: 'Hembra', edad: '2 años', raza: 'Mestizo', peso: 3.9, chip: 'CL-200001', estadoSalud: 'NORMAL', nota: 'Adoptada hace 40 días; seguimientos completados.', esterilizacion: 'SÍ (Operada)', comportamiento: 'Adaptada al hogar', creadoPor: 'adopciones' },
    { nombre: 'Canelo', especie: 'Perro', sexo: 'Macho', edad: '1.5 años', raza: 'Mestizo', peso: 13.4, chip: 'CL-200002', estadoSalud: 'NORMAL', nota: 'Adoptado recientemente; seguimiento de 15 días pendiente.', esterilizacion: 'SÍ (Operado)', comportamiento: 'Muy activo', creadoPor: 'adopciones2' },
    { nombre: 'Trufa', especie: 'Perro', sexo: 'Hembra', edad: '3 años', raza: 'Mestizo', peso: 14.0, chip: 'CL-200003', estadoSalud: 'NORMAL', nota: 'Devuelta por cambio de domicilio; reingresada al refugio.', esterilizacion: 'SÍ (Operada)', comportamiento: 'Sociable, se adapta rápido', creadoPor: 'adopciones' },

    // Animales con solicitudes en distintas etapas
    { nombre: 'Aurora', especie: 'Gato', sexo: 'Hembra', edad: '1 año', raza: 'Mestizo', peso: 3.2, estadoSalud: 'NORMAL', nota: 'Solicitud recién recibida.', esterilizacion: 'SÍ (Operada)', comportamiento: 'Curiosa y juguetona', creadoPor: 'adopciones' },
    { nombre: 'Bigotes', especie: 'Gato', sexo: 'Macho', edad: '2 años', raza: 'Mestizo', peso: 4.5, estadoSalud: 'NORMAL', nota: 'En evaluación de adopción.', esterilizacion: 'SÍ (Operado)', comportamiento: 'Tranquilo, dormilón', creadoPor: 'adopciones' },
    { nombre: 'Chispa', especie: 'Perro', sexo: 'Hembra', edad: '2 años', raza: 'Mestizo', peso: 10.1, estadoSalud: 'NORMAL', nota: 'Visita al hogar agendada.', esterilizacion: 'SÍ (Operada)', comportamiento: 'Enérgica y sociable', creadoPor: 'adopciones2' },
    { nombre: 'Duna', especie: 'Perro', sexo: 'Hembra', edad: '4 años', raza: 'Husky', peso: 18.2, estadoSalud: 'NORMAL', nota: 'Visita realizada; evaluación aprobada.', esterilizacion: 'SÍ (Operada)', comportamiento: 'Independiente, requiere ejercicio', creadoPor: 'adopciones' },
    { nombre: 'Eclipse', especie: 'Gato', sexo: 'Macho', edad: '3 años', raza: 'Negro', peso: 5.1, estadoSalud: 'NORMAL', nota: 'Solicitud aprobada, pendiente de entrega.', esterilizacion: 'SÍ (Operado)', comportamiento: 'Tranquilo, observador', creadoPor: 'adopciones2' },
    { nombre: 'Frida', especie: 'Perro', sexo: 'Hembra', edad: '6 años', raza: 'Mestizo', peso: 16.7, estadoSalud: 'ESPECIAL', nota: 'Solicitud rechazada por evaluación de vivienda.', esterilizacion: 'SÍ (Operada)', comportamiento: 'Dócil, mayor', creadoPor: 'adopciones' },
    { nombre: 'Goliat', especie: 'Perro', sexo: 'Macho', edad: '5 años', raza: 'Rottweiler', peso: 32.4, estadoSalud: 'NORMAL', nota: 'Proceso cancelado por el postulante.', esterilizacion: 'SÍ (Operado)', comportamiento: 'Obediente, fuerte', creadoPor: 'adopciones' },

    // Cuarentena activa
    { nombre: 'Yuki', especie: 'Gato', sexo: 'Hembra', edad: '8 meses', raza: 'Mestizo', peso: 2.7, estadoSalud: 'ESPECIAL', nota: 'Ingreso con signos respiratorios leves; en aislamiento preventivo.', esterilizacion: 'NO', comportamiento: 'Asustadiza, en observación', creadoPor: 'veterinario2' }
  ];

  const animales = {};
  const nuevos = [];
  for (const [indice, a] of datos.entries()) {
    const existente = await prisma.animal.findFirst({ where: { nombre: a.nombre } });
    if (existente) {
      animales[a.nombre] = existente;
      continue;
    }
    const { creadoPor, ...campos } = a;
    animales[a.nombre] = await prisma.animal.create({
      data: { ...campos, creadoPorId: usuarios[creadoPor]?.id ?? usuarios.directora.id, creadoEn: hace(20 + indice * 2) }
    });
    nuevos.push({ nombre: a.nombre, creadoPor });
  }
  return { animales, nuevos };
}

async function sembrarAlojamientos(animales, caniles) {
  const mapa = [
    ['Toby', 'C-13'], ['Kiara', 'C-14'], ['Chocolate', 'C-15'], ['Pelusa', 'C-16'],
    ['Chispa', 'C-21'], ['Duna', 'C-21'], ['Frida', 'C-21'], ['Goliat', 'C-21'],
    ['Bingo', 'C-21'], ['Trufa', 'C-21'], ['Fiona', 'C-21'],
    ['Aurora', 'C-22'], ['Bigotes', 'C-22'], ['Eclipse', 'C-22'], ['Coco', 'C-22'], ['Nala', 'C-22'],
    ['Yuki', 'C-25']
  ];

  for (const [nombre, codigo] of mapa) {
    const animal = animales[nombre];
    const canil = caniles[codigo];
    if (!animal || !canil || animal.canilId) continue;

    const residentes = await prisma.animal.count({ where: { canilId: canil.id } });
    if (residentes >= canil.capacidad) {
      console.warn(`  Aviso: ${codigo} sin cupo para ${nombre}; se omite el alojamiento.`);
      continue;
    }
    const incompatible = await prisma.animal.findFirst({
      where: { canilId: canil.id, especie: { not: animal.especie } }
    });
    if (incompatible) {
      console.warn(`  Aviso: ${codigo} aloja otra especie; se omite el alojamiento de ${nombre}.`);
      continue;
    }

    animales[nombre] = await prisma.animal.update({
      where: { id: animal.id },
      data: { canilId: canil.id, fechaIngresoCanil: hace(10) }
    });
  }
}

async function sembrarCuarentenas(animales, caniles) {
  const datos = [
    {
      animal: 'Yuki', canil: 'C-25', estado: 'ACTIVA',
      motivo: 'Ingreso con signos respiratorios leves; aislamiento preventivo',
      inicio: hace(2), finEstimada: en(12), finReal: null,
      observaciones: 'Se controla temperatura y apetito dos veces al día.'
    },
    {
      animal: 'Trufa', canil: 'C-25', estado: 'FINALIZADA',
      motivo: 'Observación por reingreso tras devolución',
      inicio: hace(14), finEstimada: hace(9), finReal: hace(10),
      observaciones: 'Sin síntomas; se autoriza su traslado al canil grupal.'
    },
    {
      animal: 'Bingo', canil: 'C-25', estado: 'INTERRUMPIDA',
      motivo: 'Sospecha de enfermedad respiratoria descartada',
      inicio: hace(20), finEstimada: hace(6), finReal: hace(18),
      observaciones: 'Exámenes negativos; se interrumpe el aislamiento y pasa a canil grupal.'
    }
  ];

  const cuarentenas = {};
  for (const c of datos) {
    const animal = animales[c.animal];
    const canil = caniles[c.canil];
    cuarentenas[c.animal] = await asegurar('cuarentenaAnimal', { animalId: animal.id, motivo: c.motivo }, {
      animalId: animal.id,
      canilId: canil?.id ?? null,
      canilAislamiento: canil?.nombre ?? null,
      motivo: c.motivo,
      fechaInicio: c.inicio,
      fechaFinEstimada: c.finEstimada,
      fechaFinReal: c.finReal,
      estado: c.estado,
      observaciones: c.observaciones
    });
  }
  return cuarentenas;
}

async function sembrarTurnos() {
  const datos = [
    { clave: 'lun_paseos_am', diaSemana: 'Lunes', franja: 'Mañana', area: 'Paseos', cubierto: true, esCritica: false, cupoMaximo: 2, horaInicio: '08:00', horaFin: '13:00' },
    { clave: 'lun_clinica_pm', diaSemana: 'Lunes', franja: 'Tarde', area: 'Clínica', cubierto: true, esCritica: true, cupoMaximo: 1, horaInicio: '14:00', horaFin: '19:00' },
    { clave: 'mar_limpieza_am', diaSemana: 'Martes', franja: 'Mañana', area: 'Limpieza', cubierto: true, esCritica: false, cupoMaximo: 3, horaInicio: '08:00', horaFin: '13:00' },
    { clave: 'mar_paseos_pm', diaSemana: 'Martes', franja: 'Tarde', area: 'Paseos', cubierto: false, esCritica: false, cupoMaximo: 2, horaInicio: '14:00', horaFin: '19:00' },
    { clave: 'mie_alimentacion_am', diaSemana: 'Miércoles', franja: 'Mañana', area: 'Alimentación', cubierto: true, esCritica: false, cupoMaximo: 2, horaInicio: '08:00', horaFin: '13:00' },
    { clave: 'mie_clinica_pm', diaSemana: 'Miércoles', franja: 'Tarde', area: 'Clínica', cubierto: false, esCritica: true, cupoMaximo: 1, horaInicio: '14:00', horaFin: '19:00' },
    { clave: 'jue_paseos_am', diaSemana: 'Jueves', franja: 'Mañana', area: 'Paseos', cubierto: false, esCritica: false, cupoMaximo: 2, horaInicio: '08:00', horaFin: '13:00' },
    { clave: 'jue_limpieza_pm', diaSemana: 'Jueves', franja: 'Tarde', area: 'Limpieza', cubierto: true, esCritica: false, cupoMaximo: 2, horaInicio: '14:00', horaFin: '19:00' },
    { clave: 'vie_alimentacion_am', diaSemana: 'Viernes', franja: 'Mañana', area: 'Alimentación', cubierto: true, esCritica: false, cupoMaximo: 2, horaInicio: '08:00', horaFin: '13:00' },
    { clave: 'vie_paseos_pm', diaSemana: 'Viernes', franja: 'Tarde', area: 'Paseos', cubierto: false, esCritica: false, cupoMaximo: 2, horaInicio: '14:00', horaFin: '19:00' },
    { clave: 'sab_paseos_am', diaSemana: 'Sábado', franja: 'Mañana', area: 'Paseos y Socialización', cubierto: true, esCritica: false, cupoMaximo: 4, horaInicio: '09:00', horaFin: '14:00' },
    { clave: 'dom_limpieza_am', diaSemana: 'Domingo', franja: 'Mañana', area: 'Limpieza', cubierto: false, esCritica: false, cupoMaximo: 2, horaInicio: '09:00', horaFin: '13:00' }
  ];

  const turnos = {};
  for (const { clave, ...t } of datos) {
    const existente = await prisma.turno.findFirst({
      where: { diaSemana: t.diaSemana, franja: t.franja, area: t.area },
      orderBy: { id: 'asc' }
    });
    turnos[clave] = existente
      ? await prisma.turno.update({
          where: { id: existente.id },
          data: { cubierto: t.cubierto, esCritica: t.esCritica, cupoMaximo: t.cupoMaximo, estadoPlanificacion: 'CONFIRMADA', horaInicio: t.horaInicio, horaFin: t.horaFin }
        })
      : await prisma.turno.create({ data: { ...t, estadoPlanificacion: 'CONFIRMADA' } });
  }
  return turnos;
}

async function sembrarClinica(animales, usuarios) {
  const atencionesData = [
    {
      animal: 'Toby', vet: 'veterinaria', dias: 3,
      motivo: 'Cojera del miembro posterior derecho',
      diagnostico: 'Esguince leve sin compromiso óseo. Se indica reposo, analgesia y control en una semana.',
      temperatura: 38.4, peso: 12.5,
      tratamiento: { medicamento: 'Meloxicam Gotas 10ml', dosis: '0.5 ml cada 24 horas', frecuenciaHoras: 24, diasFin: 7, extra: 'Administrar con alimento para evitar molestias gástricas.' },
      procedimiento: { tipo: 'REVISION_GENERAL', descripcion: 'Evaluación ortopédica y radiografía de control.', resultado: 'Sin fractura; se indica reposo por 7 días.' }
    },
    {
      animal: 'Kiara', vet: 'veterinario2', dias: 5,
      motivo: 'Dermatitis alérgica en flancos y cuello',
      diagnostico: 'Dermatitis alérgica con lesiones leves de rascado. Se inicia antibiótico y curaciones diarias.',
      temperatura: 38.6, peso: 9.8,
      tratamiento: { medicamento: 'Amoxicilina 250mg', dosis: '1 comprimido cada 12 horas', frecuenciaHoras: 12, diasFin: 10, extra: 'Completar el esquema aunque las lesiones mejoren.' },
      procedimiento: { tipo: 'CURACION', descripcion: 'Limpieza de lesiones y aplicación de solución antiséptica.', resultado: 'Lesiones limpias; continúa curaciones diarias.' }
    },
    {
      animal: 'Chocolate', vet: 'veterinaria', dias: 8,
      motivo: 'Control post operatorio de esterilización',
      diagnostico: 'Herida quirúrgica en buen estado, sin signos de infección.',
      temperatura: 38.2, peso: 15.3,
      procedimiento: { tipo: 'ESTERILIZACION', descripcion: 'Esterilización programada y control de herida a los 7 días.', resultado: 'Procedimiento sin complicaciones.' }
    },
    {
      animal: 'Yuki', vet: 'veterinario2', dias: 2,
      motivo: 'Ingreso en cuarentena con signos respiratorios leves',
      diagnostico: 'Rinotraqueítis felina leve. Se mantiene en aislamiento y se inicia antiparasitario externo.',
      temperatura: 38.5, peso: 2.7,
      tratamiento: { medicamento: 'Ivermectina pipetas', dosis: '1 pipeta tópica única', frecuenciaHoras: 720, diasFin: 30, extra: 'Aplicar en la nuca y evitar baño por 48 horas.' },
      procedimiento: { tipo: 'DESPARASITACION_EXTERNA', descripcion: 'Aplicación de antiparasitario externo al ingreso.', resultado: 'Sin reacciones adversas.' }
    },
    {
      animal: 'Pelusa', vet: 'veterinaria', dias: 12,
      motivo: 'Control de artrosis y dolor articular',
      diagnostico: 'Artrosis leve en articulaciones del tren posterior. Se ajusta analgesia y control de peso.',
      temperatura: 38.1, peso: 4.2,
      tratamiento: { medicamento: 'Meloxicam Gotas 10ml', dosis: '0.2 ml cada 24 horas', frecuenciaHoras: 24, diasFin: 30, extra: 'Reevaluar función renal en 30 días.' },
      procedimiento: { tipo: 'REVISION_GENERAL', descripcion: 'Evaluación de movilidad y palpación articular.', resultado: 'Dolor leve a la extensión; se mantiene analgesia.' }
    },
    {
      animal: 'Bingo', vet: 'veterinario2', dias: 4,
      motivo: 'Tos persistente y secreción nasal',
      diagnostico: 'Traqueobronquitis leve. Se indica antibiótico, reposo y aislamiento transitorio.',
      temperatura: 39.1, peso: 11.2,
      tratamiento: { medicamento: 'Amoxicilina 250mg', dosis: '1 comprimido cada 12 horas', frecuenciaHoras: 12, diasFin: 7, extra: 'Evitar paseos con otros perros hasta terminar el tratamiento.' },
      procedimiento: { tipo: 'DESPARASITACION_INTERNA', descripcion: 'Desparasitación interna de refuerzo al ingreso al canil grupal.', resultado: 'Sin complicaciones.' }
    },
    {
      animal: 'Trufa', vet: 'veterinaria', dias: 15,
      motivo: 'Control de reingreso tras devolución',
      diagnostico: 'Animal saludable, sin lesiones ni signos de maltrato. Se refuerza desparasitación.',
      temperatura: 38.3, peso: 14.0,
      tratamiento: { medicamento: 'Desparasitante oral', dosis: '1 comprimido única dosis', frecuenciaHoras: 720, diasFin: 1, extra: 'Repetir en 15 días según protocolo.' },
      procedimiento: { tipo: 'REVISION_GENERAL', descripcion: 'Examen físico completo al reingresar al refugio.', resultado: 'Sin hallazgos relevantes.' }
    }
  ];

  const atenciones = [];
  const tratamientos = {};
  const procedimientos = {};

  for (const a of atencionesData) {
    const animal = animales[a.animal];
    const veterinaria = usuarios[a.vet];

    const atencion = await asegurar('atencionClinica', { animalId: animal.id, motivo: a.motivo }, {
      animalId: animal.id,
      veterinariaId: veterinaria.id,
      motivo: a.motivo,
      diagnostico: a.diagnostico,
      temperatura: a.temperatura,
      pesoActual: a.peso,
      fechaAtencion: hace(a.dias)
    });
    atenciones.push(atencion);

    if (a.tratamiento) {
      const t = a.tratamiento;
      tratamientos[`${a.animal}:${t.medicamento}`] = await asegurar(
        'tratamientoAnimal',
        { animalId: animal.id, medicamento: t.medicamento, atencionClinicaId: atencion.id },
        {
          animalId: animal.id,
          atencionClinicaId: atencion.id,
          medicamento: t.medicamento,
          dosis: t.dosis,
          frecuenciaHoras: t.frecuenciaHoras,
          fechaInicio: hace(a.dias),
          fechaFin: en(t.diasFin),
          activo: true,
          indicacionesExtra: t.extra
        }
      );
    }

    if (a.procedimiento) {
      const p = a.procedimiento;
      procedimientos[`${a.animal}:${p.tipo}`] = await asegurar(
        'procedimientoAnimal',
        { animalId: animal.id, tipo: p.tipo, descripcion: p.descripcion },
        {
          animalId: animal.id,
          atencionClinicaId: atencion.id,
          tipo: p.tipo,
          descripcion: p.descripcion,
          resultado: p.resultado,
          fecha: hace(a.dias)
        }
      );
    }
  }

  return { atenciones, tratamientos, procedimientos };
}

async function sembrarVacunas(animales, usuarios) {
  const datos = [
    { animal: 'Toby', nombre: 'Antirrábica', dosis: '1 dosis', aplicacion: 30, vence: 335, vet: 'veterinaria', lote: 'VAC-RAB-101' },
    { animal: 'Kiara', nombre: 'Antirrábica', dosis: '1 dosis', aplicacion: 350, vence: 15, vet: 'veterinario2', lote: 'VAC-RAB-098' },
    { animal: 'Chocolate', nombre: 'Séxtuple', dosis: '1 dosis', aplicacion: 20, vence: 345, vet: 'veterinaria', lote: 'VAC-SEX-221' },
    { animal: 'Pelusa', nombre: 'Triple felina', dosis: '1 dosis', aplicacion: 60, vence: 305, vet: 'veterinaria', lote: 'VAC-FEL-310' },
    { animal: 'Bingo', nombre: 'Séxtuple', dosis: '1 dosis', aplicacion: 90, vence: 275, vet: 'veterinario2', lote: 'VAC-SEX-204' },
    { animal: 'Coco', nombre: 'Triple felina', dosis: '1 dosis', aplicacion: 120, vence: 245, vet: 'veterinaria', lote: 'VAC-FEL-287' },
    { animal: 'Fiona', nombre: 'Antirrábica', dosis: '1 dosis', aplicacion: 200, vence: 165, vet: 'veterinario2', lote: 'VAC-RAB-077' },
    { animal: 'Yuki', nombre: 'Triple felina', dosis: '1 dosis', aplicacion: 5, vence: 360, vet: 'veterinario2', lote: 'VAC-FEL-402' },
    { animal: 'Nube', nombre: 'Triple felina', dosis: '1 dosis', aplicacion: 80, vence: 285, vet: 'veterinaria', lote: 'VAC-FEL-355' },
    { animal: 'Canelo', nombre: 'Séxtuple', dosis: '1 dosis', aplicacion: 15, vence: 350, vet: 'veterinario2', lote: 'VAC-SEX-390' },
    { animal: 'Trufa', nombre: 'Antirrábica', dosis: '1 dosis', aplicacion: 100, vence: 265, vet: 'veterinaria', lote: 'VAC-RAB-140' },
    { animal: 'Mochi', nombre: 'Triple felina', dosis: '1 dosis', aplicacion: 45, vence: 320, vet: 'veterinaria', lote: 'VAC-FEL-333' },
    { animal: 'Rocky', nombre: 'Séxtuple', dosis: '1 dosis', aplicacion: 70, vence: 295, vet: 'veterinaria', lote: 'VAC-SEX-188' },
    { animal: 'Luna', nombre: 'Séxtuple', dosis: '1 dosis', aplicacion: 110, vence: 255, vet: 'veterinario2', lote: 'VAC-SEX-166' },
    { animal: 'Thor', nombre: 'Antirrábica', dosis: '1 dosis', aplicacion: 140, vence: 225, vet: 'veterinaria', lote: 'VAC-RAB-091' }
  ];

  for (const v of datos) {
    const animal = animales[v.animal];
    await asegurar('vacunaAnimal', { animalId: animal.id, nombreVacuna: v.nombre }, {
      animalId: animal.id,
      nombreVacuna: v.nombre,
      dosis: v.dosis,
      lote: v.lote,
      fechaAplicacion: hace(v.aplicacion),
      fechaVencimiento: en(v.vence),
      veterinariaId: usuarios[v.vet].id,
      observaciones: v.vence <= 30 ? 'Próxima a vencer: coordinar refuerzo.' : null
    });
  }
}

async function sembrarIndicaciones(animales, usuarios, turnos) {
  const datos = [
    {
      animal: 'Toby', categoria: 'RESTRICCION_FISICA', criticidad: 'MEDIA', autor: 'veterinaria',
      titulo: 'Reposo por esguince', instruccion: 'Evitar saltos, escaleras y paseos largos. Solo salidas cortas al patio.',
      franja: 'Mañana y tarde', inicio: 3, fin: 7,
      bitacoras: [{ voluntario: 'novato', turno: 'lun_paseos_am', dias: 2, observaciones: 'Se respetó el reposo; Toby permaneció en su canil sin incidentes.' }]
    },
    {
      animal: 'Kiara', categoria: 'HIGIENE_CURACION', criticidad: 'ALTA', autor: 'veterinario2',
      titulo: 'Curaciones diarias de dermatitis', instruccion: 'Limpiar lesiones con solución fisiológica y aplicar antiséptico indicado. Registrar evolución.',
      franja: 'Mañana', inicio: 5, fin: 10,
      bitacoras: [{ voluntario: 'novata', turno: 'mar_limpieza_am', dias: 3, observaciones: 'Lesiones sin secreción; Kiara colaboró durante la curación.' }]
    },
    {
      animal: 'Pelusa', categoria: 'MEDICACION_ORAL', criticidad: 'ALTA', autor: 'veterinaria',
      titulo: 'Meloxicam para artrosis', instruccion: 'Administrar 0.2 ml de Meloxicam con alimento cada 24 horas.',
      franja: 'Mañana', inicio: 12, fin: 30,
      bitacoras: [
        { voluntario: 'avanzado', turno: 'lun_clinica_pm', dias: 2, observaciones: 'Dosis administrada sin dificultad; apetito normal.' },
        { voluntario: 'novato', turno: 'jue_limpieza_pm', dias: 1, observaciones: 'Se dejó registro de la dosis en la ficha clínica.' }
      ]
    },
    {
      animal: 'Yuki', categoria: 'OBSERVACION_CONDUCTA', criticidad: 'MEDIA', autor: 'veterinario2',
      titulo: 'Observación en cuarentena', instruccion: 'Registrar apetito, temperatura y conducta dos veces al día. Evitar contacto con otros gatos.',
      franja: 'Mañana y tarde', inicio: 2, fin: 14,
      bitacoras: [{ voluntario: 'novata', turno: 'mie_alimentacion_am', dias: 1, observaciones: 'Yuki comió la mitad de la ración; se mantiene alerta y evita el contacto.' }]
    },
    {
      animal: 'Bingo', categoria: 'MEDICACION_ORAL', criticidad: 'ALTA', autor: 'veterinario2',
      titulo: 'Amoxicilina para traqueobronquitis', instruccion: 'Administrar 1 comprimido cada 12 horas durante 7 días. Completar el tratamiento.',
      franja: 'Mañana y tarde', inicio: 4, fin: 7,
      bitacoras: [{ voluntario: 'novato', turno: 'jue_paseos_am', dias: 2, observaciones: 'Tos menos frecuente; se administró la dosis de la mañana.' }]
    },
    {
      animal: 'Chocolate', categoria: 'DIETA_ESPECIAL', criticidad: 'BAJA', autor: 'veterinaria',
      titulo: 'Dieta post operatorio', instruccion: 'Alimento blando en porciones pequeñas durante 5 días. Agua fresca disponible.',
      franja: 'Mañana y tarde', inicio: 8, fin: 5,
      bitacoras: [{ voluntario: 'novata', turno: 'vie_alimentacion_am', dias: 5, observaciones: 'Aceptó bien la dieta blanda; sin vómitos ni diarrea.' }]
    },
    {
      animal: 'Trufa', categoria: 'OBSERVACION_CONDUCTA', criticidad: 'BAJA', autor: 'adopciones',
      titulo: 'Adaptación tras devolución', instruccion: 'Observar interacción con otros perros y registrar signos de ansiedad por separación.',
      franja: 'Tarde', inicio: 15, fin: 20,
      bitacoras: [{ voluntario: 'avanzado', turno: 'sab_paseos_am', dias: 4, observaciones: 'Trufa jugó con el grupo sin conflictos; buena respuesta al reencuentro.' }]
    }
  ];

  const indicaciones = {};
  for (const ind of datos) {
    const animal = animales[ind.animal];
    const indicacion = await asegurar('indicacionCuidado', { animalId: animal.id, titulo: ind.titulo }, {
      animalId: animal.id,
      contexto: 'EVALUACION_CLINICA',
      categoria: ind.categoria,
      criticidad: ind.criticidad,
      titulo: ind.titulo,
      instruccion: ind.instruccion,
      franjaHoraria: ind.franja,
      fechaInicio: hace(ind.inicio),
      fechaFin: en(ind.fin),
      publicadaTurno: true,
      creadoPorId: usuarios[ind.autor].id,
      activo: true
    });
    indicaciones[ind.titulo] = indicacion;

    for (const b of ind.bitacoras) {
      await asegurar('bitacoraCuidado', { indicacionId: indicacion.id, voluntarioId: usuarios[b.voluntario].id }, {
        indicacionId: indicacion.id,
        voluntarioId: usuarios[b.voluntario].id,
        turnoId: turnos[b.turno]?.id ?? null,
        fechaHora: hace(b.dias),
        observaciones: b.observaciones,
        atencionEstado: 'COMPLETADO'
      });
    }
  }
  return indicaciones;
}

async function sembrarInsumos() {
  const datos = [
    { nombre: 'Alimento seco perros 15kg', categoria: 'Alimento', stock: 18, stockMinimo: 10, unidad: 'Sacos', esFarmaco: false, ubicacion: 'Bodega Central', fechaVencimiento: en(180), lote: 'LOT-ALM-2026' },
    { nombre: 'Alimento húmedo gatos', categoria: 'Alimento', stock: 18, stockMinimo: 12, unidad: 'Latas', esFarmaco: false, ubicacion: 'Cocina Gatera', fechaVencimiento: en(15), lote: 'LOT-FEL-991' },
    { nombre: 'Amoxicilina 250mg', categoria: 'Medicamento', stock: 8, stockMinimo: 15, unidad: 'Cajas', esFarmaco: true, ubicacion: 'Farmacia Clínica', fechaVencimiento: en(15), lote: 'MED-AMX-044' },
    { nombre: 'Ivermectina pipetas', categoria: 'Medicamento', stock: 1, stockMinimo: 8, unidad: 'Pipetas', esFarmaco: true, ubicacion: 'Farmacia Clínica', fechaVencimiento: en(180), lote: 'MED-IVR-112' },
    { nombre: 'Desinfectante caniles 5L', categoria: 'Higiene', stock: 2, stockMinimo: 6, unidad: 'Bidones', esFarmaco: false, ubicacion: 'Patio Limpieza', fechaVencimiento: en(180), lote: 'HIG-DES-301' },
    { nombre: 'Vendas elásticas', categoria: 'Equipamiento', stock: 15, stockMinimo: 5, unidad: 'Unidades', esFarmaco: false, ubicacion: 'Botiquín Primeros Auxilios', fechaVencimiento: en(180), lote: 'HIG-VEN-009' },
    { nombre: 'Meloxicam Gotas 10ml', categoria: 'Medicamento', stock: 7, stockMinimo: 4, unidad: 'Frascos', esFarmaco: true, ubicacion: 'Farmacia Clínica', fechaVencimiento: en(180), lote: 'MED-MLX-770' },
    { nombre: 'Alimento seco gatos 10kg', categoria: 'Alimento', stock: 11, stockMinimo: 6, unidad: 'Sacos', esFarmaco: false, ubicacion: 'Bodega Central', fechaVencimiento: en(200), lote: 'LOT-GAT-2026' },
    { nombre: 'Guantes de examen', categoria: 'Higiene', stock: 40, stockMinimo: 20, unidad: 'Cajas', esFarmaco: false, ubicacion: 'Bodega Central', fechaVencimiento: en(400), lote: 'HIG-GUA-118' },
    { nombre: 'Gasas estériles', categoria: 'Higiene', stock: 1, stockMinimo: 10, unidad: 'Paquetes', esFarmaco: false, ubicacion: 'Botiquín Primeros Auxilios', fechaVencimiento: en(250), lote: 'HIG-GAS-045' },
    { nombre: 'Jeringas 5ml', categoria: 'Equipamiento', stock: 57, stockMinimo: 25, unidad: 'Unidades', esFarmaco: false, ubicacion: 'Farmacia Clínica', fechaVencimiento: en(500), lote: 'EQU-JER-221' },
    { nombre: 'Antipulgas spray', categoria: 'Medicamento', stock: 6, stockMinimo: 4, unidad: 'Frascos', esFarmaco: true, ubicacion: 'Farmacia Clínica', fechaVencimiento: en(180), lote: 'MED-ANT-310' },
    { nombre: 'Transportadoras medianas', categoria: 'Equipamiento', stock: 5, stockMinimo: 2, unidad: 'Unidades', esFarmaco: false, ubicacion: 'Bodega Central', fechaVencimiento: null, lote: 'EQU-TRA-007' },
    { nombre: 'Pañales desechables', categoria: 'Higiene', stock: 18, stockMinimo: 8, unidad: 'Paquetes', esFarmaco: false, ubicacion: 'Bodega Central', fechaVencimiento: en(300), lote: 'HIG-PAN-512' }
  ];

  const insumos = {};
  const nuevos = [];
  for (const i of datos) {
    const existente = await prisma.insumo.findFirst({ where: { nombre: i.nombre } });
    if (existente) {
      insumos[i.nombre] = existente;
      continue;
    }
    insumos[i.nombre] = await prisma.insumo.create({ data: i });
    nuevos.push(i.nombre);
  }
  return { insumos, nuevos };
}

async function sembrarMovimientos(insumos, animales, tratamientos, usuarios) {
  const datos = [
    { insumo: 'Alimento seco perros 15kg', tipo: 'ENTRADA', subtipo: 'DONACION', cantidad: 18, stockAnterior: 0, stockNuevo: 18, motivo: 'Campaña solidaria de invierno', donante: 'Fundación Huellitas Amigas', registradoPor: 'directora', dias: 25 },
    { insumo: 'Guantes de examen', tipo: 'ENTRADA', subtipo: 'COMPRA', cantidad: 40, stockAnterior: 0, stockNuevo: 40, motivo: 'Compra mensual de insumos clínicos', donante: 'Distribuidora VetSalud', registradoPor: 'veterinaria', dias: 18 },
    { insumo: 'Transportadoras medianas', tipo: 'ENTRADA', subtipo: 'DONACION', cantidad: 5, stockAnterior: 0, stockNuevo: 5, motivo: 'Donación de transportadoras para traslados', donante: 'Colegio San Andrés', registradoPor: 'adopciones', dias: 12 },
    { insumo: 'Alimento seco perros 15kg', tipo: 'SALIDA', subtipo: 'CONSUMO', cantidad: 2, stockAnterior: 18, stockNuevo: 16, motivo: 'Ración diaria de caniles grupales', registradoPor: 'novato', dias: 9 },
    { insumo: 'Alimento húmedo gatos', tipo: 'SALIDA', subtipo: 'CONSUMO', cantidad: 6, stockAnterior: 24, stockNuevo: 18, motivo: 'Alimentación de gateras', registradoPor: 'novata', dias: 7 },
    { insumo: 'Amoxicilina 250mg', tipo: 'SALIDA', subtipo: 'TRATAMIENTO_MEDICO', cantidad: 2, stockAnterior: 10, stockNuevo: 8, motivo: 'Antibiótico para traqueobronquitis', animal: 'Bingo', tratamiento: { animal: 'Bingo', medicamento: 'Amoxicilina 250mg' }, lote: 'MED-AMX-044', registradoPor: 'veterinario2', dias: 4 },
    { insumo: 'Meloxicam Gotas 10ml', tipo: 'SALIDA', subtipo: 'TRATAMIENTO_MEDICO', cantidad: 1, stockAnterior: 8, stockNuevo: 7, motivo: 'Analgésico para artrosis', animal: 'Pelusa', tratamiento: { animal: 'Pelusa', medicamento: 'Meloxicam Gotas 10ml' }, lote: 'MED-MLX-770', registradoPor: 'veterinaria', dias: 12 },
    { insumo: 'Ivermectina pipetas', tipo: 'SALIDA', subtipo: 'TRATAMIENTO_MEDICO', cantidad: 1, stockAnterior: 2, stockNuevo: 1, motivo: 'Antiparasitario externo en cuarentena', animal: 'Yuki', tratamiento: { animal: 'Yuki', medicamento: 'Ivermectina pipetas' }, lote: 'MED-IVR-112', registradoPor: 'veterinario2', dias: 2 },
    { insumo: 'Desinfectante caniles 5L', tipo: 'SALIDA', subtipo: 'CONSUMO', cantidad: 1, stockAnterior: 3, stockNuevo: 2, motivo: 'Sanitización semanal de caniles', registradoPor: 'novato', dias: 6 },
    { insumo: 'Gasas estériles', tipo: 'SALIDA', subtipo: 'MERMA', cantidad: 2, stockAnterior: 3, stockNuevo: 1, motivo: 'Paquete dañado por humedad en bodega', registradoPor: 'directora', dias: 3 },
    { insumo: 'Jeringas 5ml', tipo: 'SALIDA', subtipo: 'AJUSTE', cantidad: 3, stockAnterior: 60, stockNuevo: 57, motivo: 'Ajuste por conteo físico mensual', registradoPor: 'directora', dias: 1 },
    { insumo: 'Alimento seco gatos 10kg', tipo: 'SALIDA', subtipo: 'CONSUMO', cantidad: 1, stockAnterior: 12, stockNuevo: 11, motivo: 'Ración semanal de gateras', registradoPor: 'novata', dias: 1 }
  ];

  for (const m of datos) {
    const insumo = insumos[m.insumo];
    if (!insumo) continue;
    const animal = m.animal ? animales[m.animal] : null;
    const tratamiento = m.tratamiento
      ? tratamientos[`${m.tratamiento.animal}:${m.tratamiento.medicamento}`]
      : null;

    await asegurar('movimientoInventario', { insumoId: insumo.id, tipo: m.tipo, subtipo: m.subtipo, motivo: m.motivo }, {
      insumoId: insumo.id,
      tipo: m.tipo,
      subtipo: m.subtipo,
      cantidad: m.cantidad,
      stockAnterior: m.stockAnterior,
      stockNuevo: m.stockNuevo,
      motivo: m.motivo,
      donanteOProveedor: m.donante ?? null,
      animalId: animal?.id ?? null,
      tratamientoId: tratamiento?.id ?? null,
      lote: m.lote ?? null,
      registradoPorId: usuarios[m.registradoPor].id,
      fecha: hace(m.dias)
    });
  }
}

async function sembrarPostulantes() {
  const datos = [
    { nombre: 'Ana González', rut: '12.345.678-9', telefono: '+56 9 8877 6655', email: 'ana.gonzalez@example.cl', direccion: 'Av. Central 123, Rancagua' },
    { nombre: 'Carlos Pérez', rut: '9.876.543-2', telefono: '+56 9 7766 5544', email: 'carlos.perez@example.cl', direccion: 'Los Robles 456, Machalí' },
    { nombre: 'María López', rut: '15.111.222-3', telefono: '+56 9 6655 4433', email: 'maria.lopez@example.cl', direccion: 'Pasaje El Sol 789, Rancagua' },
    { nombre: 'Pedro Ramírez', rut: '18.222.333-4', telefono: '+56 9 5544 3322', email: 'pedro.ramirez@example.cl', direccion: 'Villa Los Aromos 101, Rancagua' },
    { nombre: 'Camila Torres', rut: '19.333.444-5', telefono: '+56 9 4433 2211', email: 'camila.torres@example.cl', direccion: 'Calle Aurora 202, Machalí' },
    { nombre: 'Diego Fuentes', rut: '20.444.555-6', telefono: '+56 9 3322 1100', email: 'diego.fuentes@example.cl', direccion: 'Av. San Martín 303, Rancagua' },
    { nombre: 'Fernanda Rojas', rut: '21.555.666-7', telefono: '+56 9 2211 0099', email: 'fernanda.rojas@example.cl', direccion: 'Pasaje Los Cerezos 404, Graneros' },
    { nombre: 'Jorge Salinas', rut: '22.666.777-8', telefono: '+56 9 1100 9988', email: 'jorge.salinas@example.cl', direccion: 'Calle Colo-Colo 505, Rancagua' },
    { nombre: 'Rosa Muñoz', rut: '23.777.888-9', telefono: '+56 9 9988 8877', email: 'rosa.munoz@example.cl', direccion: 'Pasaje Las Lilas 606, Doñihue', activo: false },
    { nombre: 'Ignacio Vega', rut: '24.888.999-0', telefono: '+56 9 8877 7766', email: 'ignacio.vega@example.cl', direccion: 'Av. Bernardo O\'Higgins 707, Rancagua' },
    { nombre: 'Paula Herrera', rut: '25.999.000-1', telefono: '+56 9 7766 6655', email: 'paula.herrera@example.cl', direccion: 'Calle Los Nogales 808, Machalí' },
    { nombre: 'Matías Cárdenas', rut: '26.111.222-3', telefono: '+56 9 6655 5544', email: 'matias.cardenas@example.cl', direccion: 'Pasaje El Bosque 909, Rancagua' },
    { nombre: 'Valentina Soto', rut: '27.222.333-4', telefono: '+56 9 5544 4433', email: 'valentina.soto@example.cl', direccion: 'Av. Los Libertadores 1010, Rancagua' }
  ];

  const postulantes = {};
  for (const p of datos) {
    postulantes[p.nombre] = await prisma.postulante.upsert({ where: { rut: p.rut }, update: {}, create: p });
  }
  return postulantes;
}

async function sembrarAdopciones({ animales, postulantes, usuarios, caniles }) {
  const cadenas = {
    RECIBIDA: [],
    EN_EVALUACION: [['EVALUAR', 'RECIBIDA', 'EN_EVALUACION', 'CUMPLE']],
    VISITA_AGENDADA: [['EVALUAR', 'RECIBIDA', 'EN_EVALUACION', 'CUMPLE'], ['AGENDAR_VISITA', 'EN_EVALUACION', 'VISITA_AGENDADA', null]],
    VISITA_REALIZADA: [['EVALUAR', 'RECIBIDA', 'EN_EVALUACION', 'CUMPLE'], ['AGENDAR_VISITA', 'EN_EVALUACION', 'VISITA_AGENDADA', null], ['REGISTRAR_VISITA', 'VISITA_AGENDADA', 'VISITA_REALIZADA', null]],
    APROBADA: [['EVALUAR', 'RECIBIDA', 'EN_EVALUACION', 'CUMPLE'], ['AGENDAR_VISITA', 'EN_EVALUACION', 'VISITA_AGENDADA', null], ['REGISTRAR_VISITA', 'VISITA_AGENDADA', 'VISITA_REALIZADA', null], ['APROBAR', 'VISITA_REALIZADA', 'APROBADA', null]],
    RECHAZADA: [['EVALUAR', 'RECIBIDA', 'EN_EVALUACION', 'CUMPLE'], ['EVALUAR', 'EN_EVALUACION', 'RECHAZADA', 'NO_CUMPLE']],
    CANCELADA: [['EVALUAR', 'RECIBIDA', 'EN_EVALUACION', 'CUMPLE'], ['AGENDAR_VISITA', 'EN_EVALUACION', 'VISITA_AGENDADA', null], ['REGISTRAR_VISITA', 'VISITA_AGENDADA', 'VISITA_REALIZADA', null], ['APROBAR', 'VISITA_REALIZADA', 'APROBADA', null], ['CANCELAR', 'APROBADA', 'CANCELADA', null]],
    ENTREGADA: [['EVALUAR', 'RECIBIDA', 'EN_EVALUACION', 'CUMPLE'], ['AGENDAR_VISITA', 'EN_EVALUACION', 'VISITA_AGENDADA', null], ['REGISTRAR_VISITA', 'VISITA_AGENDADA', 'VISITA_REALIZADA', null], ['APROBAR', 'VISITA_REALIZADA', 'APROBADA', null], ['ENTREGAR', 'APROBADA', 'ENTREGADA', null]]
  };

  const observaciones = {
    EVALUAR: 'Se revisaron antecedentes, vivienda y disponibilidad de tiempo del postulante.',
    AGENDAR_VISITA: 'Visita al hogar agendada con el postulante.',
    REGISTRAR_VISITA: 'Visita realizada; el hogar cumple con las condiciones observadas.',
    APROBAR: 'Solicitud aprobada para concretar la adopción.',
    RECHAZAR: 'La evaluación no cumple con los requisitos del refugio.',
    CANCELAR: 'El postulante canceló el proceso de adopción.',
    ENTREGAR: 'Entrega concretada con ficha y seguimiento programado.'
  };

  const solicitudesData = [
    { clave: 'aurora', postulante: 'Pedro Ramírez', animal: 'Aurora', estado: 'RECIBIDA', creado: 2, registradoPor: 'adopciones', motivacion: 'Busco una compañera tranquila para mi departamento y tengo experiencia con gatos.' },
    { clave: 'bigotes', postulante: 'Camila Torres', animal: 'Bigotes', estado: 'EN_EVALUACION', creado: 6, registradoPor: 'adopciones', motivacion: 'Vivo sola con mi hija y queremos incorporar un gato adulto a la familia.' },
    { clave: 'chispa', postulante: 'Diego Fuentes', animal: 'Chispa', estado: 'VISITA_AGENDADA', creado: 10, registradoPor: 'adopciones2', motivacion: 'Tenemos patio cerrado y tiempo para paseos diarios.' },
    { clave: 'duna', postulante: 'Fernanda Rojas', animal: 'Duna', estado: 'VISITA_REALIZADA', creado: 14, registradoPor: 'adopciones', motivacion: 'Me interesa una perra activa para acompañarme a trotar.' },
    { clave: 'eclipse', postulante: 'Jorge Salinas', animal: 'Eclipse', estado: 'APROBADA', creado: 18, registradoPor: 'adopciones2', motivacion: 'Busco un gato tranquilo para un hogar sin otros animales.' },
    { clave: 'frida', postulante: 'Rosa Muñoz', animal: 'Frida', estado: 'RECHAZADA', creado: 22, registradoPor: 'adopciones', motivacion: 'Quiero adoptar una perra mayor para compañía.' },
    { clave: 'goliat', postulante: 'Ignacio Vega', animal: 'Goliat', estado: 'CANCELADA', creado: 26, registradoPor: 'adopciones', motivacion: 'Busco un perro grande para cuidar el patio.' },
    { clave: 'nube', postulante: 'Paula Herrera', animal: 'Nube', estado: 'ENTREGADA', creado: 45, entrega: 40, registradoPor: 'adopciones', motivacion: 'Quiero darle un hogar definitivo a una gata adulta.' },
    { clave: 'canelo', postulante: 'Matías Cárdenas', animal: 'Canelo', estado: 'ENTREGADA', creado: 15, entrega: 10, registradoPor: 'adopciones2', motivacion: 'Somos una familia activa y buscamos un perro joven.' },
    { clave: 'trufa', postulante: 'Valentina Soto', animal: 'Trufa', estado: 'ENTREGADA', creado: 65, entrega: 60, registradoPor: 'adopciones', motivacion: 'Queremos adoptar una perra sociable para nuestra casa con patio.' }
  ];

  const datosDe = p => ({
    nombre: p.nombre,
    rut: p.rut,
    tipoIdentificacion: p.tipoIdentificacion,
    email: p.email,
    telefono: p.telefono,
    direccion: p.direccion
  });

  const seguimientosData = {
    nube: [
      {
        tipo: 'SEGUIMIENTO_15_DIAS', dias: 15, programada: hace(25), ejecucion: hace(24),
        canal: 'WHATSAPP', estado: 'COMPLETADO', estadoAnimal: 'Saludable y adaptada',
        resultado: 'Seguimiento exitoso', obs: 'La familia reporta buena adaptación y rutina de alimentación estable.',
        intentos: [{ numero: 1, dias: 24, canal: 'WHATSAPP', contactado: true, resultado: 'Contacto exitoso', obs: 'Se recibieron fotos y se confirmó el uso del arenero.' }]
      },
      {
        tipo: 'SEGUIMIENTO_30_DIAS', dias: 30, programada: hace(10), ejecucion: hace(9),
        canal: 'VISITA_DOMICILIARIA', estado: 'COMPLETADO', estadoAnimal: 'Saludable',
        resultado: 'Adaptación consolidada', obs: 'Visita al hogar sin observaciones; espacio seguro y limpio.',
        intentos: [{ numero: 1, dias: 9, canal: 'VISITA_DOMICILIARIA', contactado: true, resultado: 'Visita conforme', obs: 'Se verificaron condiciones del hogar y estado del animal.' }]
      }
    ],
    canelo: [
      { tipo: 'SEGUIMIENTO_15_DIAS', dias: 15, programada: en(5), estado: 'PENDIENTE' },
      { tipo: 'SEGUIMIENTO_30_DIAS', dias: 30, programada: en(20), estado: 'PENDIENTE' }
    ],
    trufa: [
      {
        tipo: 'SEGUIMIENTO_15_DIAS', dias: 15, programada: hace(45), ejecucion: hace(44),
        canal: 'LLAMADA_TELEFONICA', estado: 'COMPLETADO', estadoAnimal: 'Saludable',
        resultado: 'Sin observaciones', obs: 'Primer seguimiento conforme; la familia reporta buena convivencia.',
        intentos: [{ numero: 1, dias: 44, canal: 'LLAMADA_TELEFONICA', contactado: true, resultado: 'Contacto exitoso', obs: 'Se conversó con la adoptante y se resolvieron dudas de alimentación.' }]
      },
      {
        tipo: 'SEGUIMIENTO_30_DIAS', dias: 30, programada: hace(30), estado: 'SIN_CONTACTO',
        intentosFallidos: 3, limiteIntentos: 3, alertaSinContacto: true, fechaAlerta: hace(20),
        obs: 'No fue posible contactar a la familia; se activó la alerta para visita presencial.',
        intentos: [
          { numero: 1, dias: 28, canal: 'LLAMADA_TELEFONICA', contactado: false, resultado: 'Sin respuesta', obs: 'Se dejó mensaje de voz.', fechaReprogramada: hace(26) },
          { numero: 2, dias: 26, canal: 'WHATSAPP', contactado: false, resultado: 'Mensaje sin respuesta', obs: 'Mensaje entregado sin lectura.', fechaReprogramada: hace(24) },
          { numero: 3, dias: 24, canal: 'CORREO_ELECTRONICO', contactado: false, resultado: 'Correo rebotado', obs: 'La dirección registrada ya no existe.' }
        ]
      }
    ]
  };

  for (const s of solicitudesData) {
    const animal = animales[s.animal];
    const postulante = postulantes[s.postulante];
    const autor = autorDe(usuarios, s.registradoPor);

    const solicitud = await asegurar('solicitudAdopcion', { postulanteId: postulante.id, animalId: animal.id }, {
      postulanteId: postulante.id,
      animalId: animal.id,
      registradoPorId: usuarios[s.registradoPor].id,
      estado: s.estado,
      motivacion: s.motivacion,
      datosPostulante: datosDe(postulante),
      creadoEn: hace(s.creado),
      visitaOmitida: false
    });

    let paso = 0;
    for (const [accion, anterior, nuevo, resultado] of cadenas[s.estado]) {
      const fecha = accion === 'ENTREGAR' ? hace(s.entrega) : hace(Math.max(0, s.creado - paso - 1));
      await asegurar('etapaSolicitudAdopcion', { solicitudId: solicitud.id, accion, estadoNuevo: nuevo }, {
        solicitudId: solicitud.id,
        accion,
        estadoAnterior: anterior,
        estadoNuevo: nuevo,
        fecha,
        registradoEn: fecha,
        observaciones: resultado === 'NO_CUMPLE' ? observaciones.RECHAZAR : observaciones[accion],
        resultadoEvaluacion: resultado,
        motivoOmision: null,
        responsableId: usuarios[s.registradoPor].id
      });
      paso++;
    }

    await auditar(`solicitud:creacion:${s.clave}`, {
      entidad: 'SolicitudAdopcion', entidadId: solicitud.id, accion: 'CREACION',
      valorNuevo: { estado: s.estado, animal: animal.nombre, postulante: postulante.nombre },
      ...autor, fechaHora: hace(s.creado)
    });

    if (s.estado !== 'ENTREGADA') continue;

    const etapa = s.clave === 'nube' ? 'Seguimiento 30d' : s.clave === 'trufa' ? 'Devuelto' : 'Adoptado';
    const adopcion = await prisma.adopcion.upsert({
      where: { solicitudId: solicitud.id },
      update: { etapa, devolucion: s.clave === 'trufa', fecha: hace(s.entrega) },
      create: {
        solicitudId: solicitud.id,
        animalId: animal.id,
        postulanteId: postulante.id,
        fecha: hace(s.entrega),
        etapa,
        devolucion: s.clave === 'trufa',
        responsableId: usuarios[s.registradoPor].id
      }
    });

    if (s.clave === 'trufa') {
      await prisma.animal.update({
        where: { id: animal.id },
        data: { estadoAdopcion: 'EN_REFUGIO', canilId: caniles['C-21']?.id ?? null, fechaIngresoCanil: hace(15) }
      });
    } else {
      await prisma.animal.update({
        where: { id: animal.id },
        data: { estadoAdopcion: 'ADOPTADO', canilId: null, fechaIngresoCanil: null }
      });
    }

    for (const t of seguimientosData[s.clave] ?? []) {
      const seguimiento = await asegurar('seguimientoAdopcion', { adopcionId: adopcion.id, tipoSeguimiento: t.tipo }, {
        adopcionId: adopcion.id,
        tipoSeguimiento: t.tipo,
        diasProgramados: t.dias,
        fechaProgramada: t.programada,
        fechaEjecucion: t.ejecucion ?? null,
        canalContacto: t.canal ?? null,
        estadoAnimal: t.estadoAnimal ?? null,
        resultado: t.resultado ?? null,
        observaciones: t.obs ?? null,
        intentosFallidos: t.intentosFallidos ?? 0,
        limiteIntentos: t.limiteIntentos ?? 3,
        estado: t.estado,
        alertaSinContacto: t.alertaSinContacto ?? false,
        fechaAlerta: t.fechaAlerta ?? null,
        responsableId: usuarios.adopciones.id
      });

      for (const it of t.intentos ?? []) {
        await asegurar('intentoSeguimiento', { seguimientoId: seguimiento.id, numeroIntento: it.numero }, {
          seguimientoId: seguimiento.id,
          numeroIntento: it.numero,
          fecha: hace(it.dias),
          canalContacto: it.canal,
          contactado: it.contactado,
          resultado: it.resultado,
          observaciones: it.obs ?? null,
          fechaReprogramada: it.fechaReprogramada ?? null,
          responsableId: usuarios.adopciones.id
        });
      }
    }

    if (s.clave === 'trufa') {
      const devolucion = await asegurar('devolucion', { adopcionId: adopcion.id }, {
        adopcionId: adopcion.id,
        animalId: animal.id,
        postulanteId: postulante.id,
        fecha: hace(15),
        motivo: 'La familia se muda a un departamento sin espacio para la mascota',
        estadoAnimal: 'Saludable, sin lesiones ni signos de maltrato',
        observacionesPostulante: 'Solicitaron el reingreso voluntario y entregaron todos los implementos.',
        responsableId: usuarios.adopciones.id
      });

      await auditar('devolucion:creacion:trufa', {
        entidad: 'Devolucion', entidadId: devolucion.id, accion: 'CREACION',
        valorNuevo: { animal: animal.nombre, postulante: postulante.nombre, motivo: devolucion.motivo },
        ...autorDe(usuarios, 'adopciones'), fechaHora: hace(15)
      });
    }

    await auditar(`adopcion:creacion:${s.clave}`, {
      entidad: 'Adopcion', entidadId: adopcion.id, accion: 'CREACION',
      valorNuevo: { etapa, animal: animal.nombre, postulante: postulante.nombre },
      ...autor, fechaHora: hace(s.entrega)
    });
  }
}

async function sembrarTraslados({ animales, caniles, usuarios }) {
  const datos = [
    {
      animal: 'Trufa', tipo: 'INTERNO_CANIL', estado: 'COMPLETADO', canilDestino: 'C-21',
      motivo: 'Devolución al refugio', responsable: 'adopciones', dias: 15
    },
    {
      animal: 'Nala', tipo: 'PROTECTORA_ALIADA', estado: 'APROBADO', responsable: 'adopciones',
      motivo: 'Traslado a protectora aliada por convenio de adopción',
      destinoNombre: 'Refugio Amigos Fieles', destinoContacto: '+56 9 5555 1234',
      destinoDireccion: 'Av. Los Aromos 1234, Rancagua', destinoEmail: 'contacto@amigosfieles.cl',
      aprobadoPor: 'directora', comentario: 'Convenio vigente y cupo confirmado.', dias: 8
    },
    {
      animal: 'Bingo', tipo: 'PROTECTORA_ALIADA', estado: 'PENDIENTE_APROBACION', responsable: 'adopciones2',
      motivo: 'Evaluación de traslado a protectora con cupo disponible',
      destinoNombre: 'Protectora Patitas Felices', destinoContacto: '+56 9 4444 5678',
      destinoDireccion: 'Camino El Molino 567, Machalí', destinoEmail: 'hola@patitasfelices.cl',
      dias: 1
    },
    {
      animal: 'Coco', tipo: 'HOGAR_TEMPORAL', estado: 'PENDIENTE_APROBACION', responsable: 'adopciones',
      motivo: 'Hogar temporal mientras se recupera del estrés del refugio',
      destinoNombre: 'Familia Soto', destinoContacto: '+56 9 3333 4567',
      destinoDireccion: 'Pasaje Los Almendros 890, Rancagua', destinoEmail: 'familia.soto@example.cl',
      dias: 2
    },
    {
      animal: 'Fiona', tipo: 'HOGAR_TEMPORAL', estado: 'RECHAZADO', responsable: 'adopciones2',
      motivo: 'Solicitud de hogar temporal fuera de la comuna',
      destinoNombre: 'Familia Herrera', destinoContacto: '+56 9 2222 3456',
      destinoDireccion: 'Av. Matta 1234, Santiago', destinoEmail: 'familia.herrera@example.cl',
      aprobadoPor: 'directora', comentario: 'El domicilio queda fuera del radio de seguimiento del refugio.', dias: 12
    }
  ];

  for (const t of datos) {
    const animal = animales[t.animal];
    const destino = t.canilDestino ? caniles[t.canilDestino] : null;
    const traslado = await asegurar('traslado', { animalId: animal.id, tipo: t.tipo, motivo: t.motivo }, {
      animalId: animal.id,
      tipo: t.tipo,
      motivo: t.motivo,
      estado: t.estado,
      canilOrigenId: null,
      canilDestinoId: destino?.id ?? null,
      destinoNombre: t.destinoNombre ?? null,
      destinoContacto: t.destinoContacto ?? null,
      destinoDireccion: t.destinoDireccion ?? null,
      destinoEmail: t.destinoEmail ?? null,
      responsableId: usuarios[t.responsable].id,
      aprobadoPorId: t.aprobadoPor ? usuarios[t.aprobadoPor].id : null,
      fechaAprobacion: t.aprobadoPor ? hace(Math.max(0, t.dias - 1)) : null,
      comentarioAprobacion: t.comentario ?? null,
      fechaRegistro: hace(t.dias)
    });

    await auditar(`traslado:creacion:${t.animal}:${t.tipo}:${t.estado}`, {
      entidad: 'Traslado', entidadId: traslado.id, accion: 'CREACION',
      valorNuevo: { animal: animal.nombre, tipo: t.tipo, estado: t.estado, destino: t.destinoNombre ?? t.canilDestino },
      ...autorDe(usuarios, t.responsable), fechaHora: hace(t.dias)
    });
  }
}

async function sembrarTurnosVoluntarios({ turnos, usuarios }) {
  const inscripciones = [
    { turno: 'lun_paseos_am', usuario: 'avanzado', estado: 'CONFIRMADA', asistencia: true, dias: 6 },
    { turno: 'lun_paseos_am', usuario: 'novato', estado: 'CONFIRMADA', asistencia: false, dias: 6 },
    { turno: 'lun_clinica_pm', usuario: 'avanzado', estado: 'CONFIRMADA', asistencia: true, dias: 5 },
    { turno: 'mar_limpieza_am', usuario: 'novato', estado: 'CONFIRMADA', asistencia: true, dias: 5 },
    { turno: 'mar_limpieza_am', usuario: 'novata', estado: 'CONFIRMADA', asistencia: false, dias: 5 },
    { turno: 'mie_alimentacion_am', usuario: 'novata', estado: 'CONFIRMADA', asistencia: true, dias: 4 },
    { turno: 'jue_limpieza_pm', usuario: 'novato', estado: 'CONFIRMADA', asistencia: false, dias: 3 },
    { turno: 'vie_alimentacion_am', usuario: 'novata', estado: 'CONFIRMADA', asistencia: true, dias: 2 },
    { turno: 'sab_paseos_am', usuario: 'avanzado', estado: 'CONFIRMADA', asistencia: false, dias: 1 },
    { turno: 'sab_paseos_am', usuario: 'novato', estado: 'CONFIRMADA', asistencia: false, dias: 1 },
    { turno: 'sab_paseos_am', usuario: 'novata', estado: 'CONFIRMADA', asistencia: false, dias: 1 }
  ];

  for (const i of inscripciones) {
    const turno = turnos[i.turno];
    const usuario = usuarios[i.usuario];
    if (!turno || !usuario) continue;
    // Se compara por día/franja/área para no duplicar si existen turnos repetidos.
    const existente = await prisma.inscripcionTurno.findFirst({
      where: {
        usuarioId: usuario.id,
        turno: { diaSemana: turno.diaSemana, franja: turno.franja, area: turno.area }
      }
    });
    if (existente) continue;
    await prisma.inscripcionTurno.create({
      data: {
        turnoId: turno.id,
        usuarioId: usuario.id,
        estado: i.estado,
        inscritoEn: hace(i.dias),
        asistenciaRegistrada: i.asistencia
      }
    });
  }

  const bitacoras = [
    {
      turno: 'lun_clinica_pm', usuario: 'avanzado', dias: 5,
      tareas: 'Apoyo en curaciones de Kiara y control de medicación de Pelusa. Registro de signos vitales.',
      incidentes: 'Sin incidentes.', observaciones: 'Se actualizaron las fichas clínicas y se repuso material de curación.'
    },
    {
      turno: 'mar_limpieza_am', usuario: 'novato', dias: 5,
      tareas: 'Limpieza y sanitización de caniles del sector A. Reposición de agua fresca y mantas limpias.',
      incidentes: 'Sin novedades.', observaciones: 'Se utilizó desinfectante según protocolo del refugio.'
    },
    {
      turno: 'sab_paseos_am', usuario: 'avanzado', dias: 1,
      tareas: 'Paseos y socialización de perros del canil grupal. Registro de conducta de Trufa.',
      incidentes: 'Trufa mostró ansiedad al inicio, luego se integró al grupo.', observaciones: 'Se recomienda mantener paseos en grupo y refuerzo positivo.'
    }
  ];

  for (const b of bitacoras) {
    const turno = turnos[b.turno];
    const usuario = usuarios[b.usuario];
    if (!turno || !usuario) continue;
    const existente = await prisma.bitacoraTurno.findFirst({
      where: {
        usuarioId: usuario.id,
        turno: { diaSemana: turno.diaSemana, franja: turno.franja, area: turno.area }
      }
    });
    if (existente) continue;
    await prisma.bitacoraTurno.create({
      data: {
        turnoId: turno.id,
        usuarioId: usuario.id,
        tareasRealizadas: b.tareas,
        incidentes: b.incidentes,
        observaciones: b.observaciones,
        fechaHora: hace(b.dias)
      }
    });
  }

  const permutas = [
    {
      solicitante: 'novato', destinatario: 'avanzado', origen: 'mar_limpieza_am', destino: 'lun_paseos_am',
      motivo: 'Compromiso académico el martes en la mañana; solicito permutar por el turno de paseos del lunes.',
      estado: 'PENDIENTE', aprobadoSolicitante: true, aprobadoDestinatario: false, dias: 1
    },
    {
      solicitante: 'novata', destinatario: 'avanzado', origen: 'mie_alimentacion_am', destino: 'jue_paseos_am',
      motivo: 'Trámite médico el miércoles; puedo cubrir el turno de paseos del jueves.',
      estado: 'APROBADA', aprobadoSolicitante: true, aprobadoDestinatario: true, dias: 4, resolucion: 3,
      observacion: 'Permuta aprobada por ambas partes; se actualizaron las inscripciones.'
    },
    {
      solicitante: 'avanzado', destinatario: 'novata', origen: 'sab_paseos_am', destino: 'dom_limpieza_am',
      motivo: 'No puedo asistir el sábado por viaje familiar; ofrezco cubrir la limpieza del domingo.',
      estado: 'RECHAZADA', aprobadoSolicitante: true, aprobadoDestinatario: false, dias: 7, resolucion: 6,
      observacion: 'La destinataria no puede cubrir el turno de domingo por disponibilidad horaria.'
    }
  ];

  for (const p of permutas) {
    const solicitante = usuarios[p.solicitante];
    const destinatario = usuarios[p.destinatario];
    const turnoOrigen = turnos[p.origen];
    const turnoDestino = turnos[p.destino];
    if (!solicitante || !destinatario || !turnoOrigen || !turnoDestino) continue;

    const existente = await prisma.permutaTurno.findFirst({
      where: {
        solicitanteId: solicitante.id,
        destinatarioId: destinatario.id,
        turnoOrigen: { diaSemana: turnoOrigen.diaSemana, franja: turnoOrigen.franja, area: turnoOrigen.area }
      }
    });
    if (existente) continue;

    await prisma.permutaTurno.create({
      data: {
        solicitanteId: solicitante.id,
        destinatarioId: destinatario.id,
        turnoOrigenId: turnoOrigen.id,
        turnoDestinoId: turnoDestino.id,
        motivo: p.motivo,
        aprobadoSolicitante: p.aprobadoSolicitante,
        aprobadoDestinatario: p.aprobadoDestinatario,
        estado: p.estado,
        fechaSolicitud: hace(p.dias),
        fechaResolucion: p.resolucion ? hace(p.resolucion) : null,
        observacionResolucion: p.observacion ?? null
      }
    });
  }
}

async function sembrarConfiguracion() {
  const datos = [
    { clave: 'SEGUIMIENTO_MAX_INTENTOS', valor: '3', descripcion: 'Intentos máximos antes de activar la alerta de sin contacto.' },
    { clave: 'NOMBRE_REFUGIO', valor: 'Huellas Sin Hogar', descripcion: 'Nombre visible en reportes y etiquetas del portal.' }
  ];

  for (const c of datos) {
    await prisma.configuracionSistema.upsert({
      where: { clave: c.clave },
      update: { descripcion: c.descripcion },
      create: c
    });
  }
}

async function sembrarLecturas({ usuarios, animales, cuarentenas }) {
  const filas = [
    { usuarioId: usuarios.directora.id, clave: `animales:${animales.Toby.id}` },
    { usuarioId: usuarios.directora.id, clave: `animales:${animales.Nube.id}` },
    { usuarioId: usuarios.directora.id, clave: 'caniles:sin-libres' },
    { usuarioId: usuarios.veterinaria.id, clave: `caniles:cuarentena:porvencer:${cuarentenas.Yuki.id}` },
    { usuarioId: usuarios.adopciones.id, clave: `animales:${animales.Trufa.id}` }
  ];

  await prisma.lecturaNotificacion.createMany({ data: filas, skipDuplicates: true });
}

async function sembrarAuditoria({ usuarios, animales, animalesNuevos, caniles, canilesNuevos, insumos, insumosNuevos, postulantes }) {
  await auditar('sistema:inicio', {
    entidad: 'Sistema', entidadId: null, accion: 'CREACION',
    valorNuevo: { descripcion: 'Inicialización de datos del refugio' },
    ...autorDe(usuarios, 'directora'), fechaHora: hace(90)
  });

  const tiposIngreso = ['Rescate', 'Entrega voluntaria', 'Traslado externo'];
  for (const [indice, nuevo] of animalesNuevos.entries()) {
    const animal = animales[nuevo.nombre];
    await auditar(`animal:creacion:${nuevo.nombre}`, {
      entidad: 'Animal', entidadId: animal.id, accion: 'CREACION',
      valorNuevo: {
        nombre: animal.nombre, especie: animal.especie, sexo: animal.sexo,
        estadoSalud: animal.estadoSalud, tipoIngreso: tiposIngreso[indice % tiposIngreso.length]
      },
      ...autorDe(usuarios, nuevo.creadoPor), fechaHora: animal.creadoEn
    });
  }

  for (const canil of canilesNuevos) {
    await auditar(`canil:creacion:${canil.codigo}`, {
      entidad: 'Canil', entidadId: caniles[canil.codigo].id, accion: 'CREACION',
      valorNuevo: { codigo: canil.codigo, nombre: canil.nombre, capacidad: canil.capacidad },
      ...autorDe(usuarios, 'directora'), fechaHora: hace(60)
    });
  }

  for (const nombre of insumosNuevos) {
    const insumo = insumos[nombre];
    await auditar(`insumo:creacion:${nombre}`, {
      entidad: 'Insumo', entidadId: insumo.id, accion: 'CREACION',
      valorNuevo: { nombre: insumo.nombre, categoria: insumo.categoria, stock: insumo.stock },
      ...autorDe(usuarios, 'directora'), fechaHora: hace(40)
    });
  }

  await auditar('canil:mantenimiento:c-24', {
    entidad: 'Canil', entidadId: caniles['C-24'].id, accion: 'MODIFICACION',
    valorNuevo: { estado: 'MANTENIMIENTO', motivo: 'Reparación de puerta y piso' },
    ...autorDe(usuarios, 'directora'), fechaHora: hace(6)
  });

  await auditar('insumo:ajuste:jeringas', {
    entidad: 'Insumo', entidadId: insumos['Jeringas 5ml'].id, accion: 'MODIFICACION',
    valorNuevo: { stock: 57, motivo: 'Ajuste por conteo físico mensual' },
    ...autorDe(usuarios, 'directora'), fechaHora: hace(1)
  });

  await auditar('turno:planificacion:semana', {
    entidad: 'Turno', entidadId: null, accion: 'MODIFICACION',
    valorNuevo: { descripcion: 'Planificación semanal confirmada', turnos: 12 },
    ...autorDe(usuarios, 'directora'), fechaHora: hace(1)
  });

  await auditar('reporte:pdf:balance', {
    entidad: 'ReportePDF', entidadId: null, accion: 'CREACION',
    valorNuevo: {
      tipoReporte: 'PDF', recursoExportado: 'Balance operativo del refugio',
      rolUsuario: 'DIRECCION', sexoUsuario: 'FEMENINO'
    },
    ...autorDe(usuarios, 'directora'), fechaHora: hace(2)
  });

  const rosa = postulantes['Rosa Muñoz'];
  if (rosa) {
    await auditar('postulante:baja:rosa', {
      entidad: 'Postulante', entidadId: rosa.id, accion: 'BAJA_LOGICA',
      valorAnterior: { activo: true }, valorNuevo: { activo: false, motivo: 'Solicitud de baja del postulante' },
      ...autorDe(usuarios, 'adopciones'), fechaHora: hace(20)
    });
  }
}

async function sincronizarCaniles() {
  const caniles = await prisma.canil.findMany({
    include: {
      animales: { select: { id: true } },
      cuarentenas: { where: { estado: 'ACTIVA' }, select: { id: true } }
    }
  });

  for (const c of caniles) {
    if (c.estado === 'MANTENIMIENTO') continue;
    const estado = c.cuarentenas.length ? 'CUARENTENA' : c.animales.length ? 'OCUPADO' : 'LIBRE';
    if (estado !== c.estado) await prisma.canil.update({ where: { id: c.id }, data: { estado } });
  }
}

async function normalizarNombresCaniles() {
  const caniles = await prisma.canil.findMany({ select: { id: true, codigo: true, nombre: true } });
  for (const canil of caniles) {
    const numero = Number(String(canil.codigo || '').match(/\d+/)?.[0] ?? canil.id);
    const nombre = `Canil ${numero}`;
    if (canil.nombre !== nombre) {
      await prisma.canil.update({ where: { id: canil.id }, data: { nombre } });
    }
  }
}

async function imprimirResumen() {
  const modelos = [
    'usuario', 'canil', 'animal', 'postulante', 'insumo', 'movimientoInventario',
    'traslado', 'atencionClinica', 'tratamientoAnimal', 'procedimientoAnimal', 'vacunaAnimal',
    'indicacionCuidado', 'bitacoraCuidado', 'cuarentenaAnimal', 'solicitudAdopcion',
    'etapaSolicitudAdopcion', 'adopcion', 'seguimientoAdopcion', 'intentoSeguimiento',
    'devolucion', 'turno', 'inscripcionTurno', 'bitacoraTurno', 'permutaTurno',
    'configuracionSistema', 'lecturaNotificacion', 'auditoria'
  ];

  console.log('\n=== DATOS DE PRUEBA CARGADOS ===');
  for (const modelo of modelos) {
    console.log(`  ${modelo}: ${await prisma[modelo].count()}`);
  }
  console.log('\nCuentas de acceso (contraseña: admin123):');
  console.log('  directora@huellas.cl / staff@huellas.cl');
  console.log('  veterinaria@huellas.cl / veterinario2@huellas.cl');
  console.log('  adopciones@huellas.cl / adopciones2@huellas.cl');
  console.log('  voluntario.avanzado@huellas.cl / voluntario@huellas.cl / voluntaria@huellas.cl');
  console.log('\nPara reiniciar el dataset desde cero: npm run prisma:seed:reset');
}

async function main() {
  if (reiniciarTodo) await reiniciar();

  const hashedPassword = await bcrypt.hash('admin123', 10);
  const usuarios = await sembrarUsuarios(hashedPassword);
  const { caniles, nuevos: canilesNuevos } = await sembrarCaniles();
  const { animales, nuevos: animalesNuevos } = await sembrarAnimales(usuarios);

  await sembrarAlojamientos(animales, caniles);
  const cuarentenas = await sembrarCuarentenas(animales, caniles);
  const turnos = await sembrarTurnos();

  const { tratamientos } = await sembrarClinica(animales, usuarios);
  await sembrarVacunas(animales, usuarios);
  await sembrarIndicaciones(animales, usuarios, turnos);

  const { insumos, nuevos: insumosNuevos } = await sembrarInsumos();
  await sembrarMovimientos(insumos, animales, tratamientos, usuarios);

  const postulantes = await sembrarPostulantes();
  await sembrarAdopciones({ animales, postulantes, usuarios, caniles });
  await sembrarTraslados({ animales, caniles, usuarios });
  await sembrarTurnosVoluntarios({ turnos, usuarios });
  await sembrarConfiguracion();
  await sembrarLecturas({ usuarios, animales, cuarentenas });
  await sembrarAuditoria({ usuarios, animales, animalesNuevos, caniles, canilesNuevos, insumos, insumosNuevos, postulantes });

  await sincronizarCaniles();
  await normalizarNombresCaniles();
  await imprimirResumen();
}

main()
  .catch(error => {
    console.error('Error al ejecutar el seed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());




