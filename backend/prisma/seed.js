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

  const voluntario = await prisma.usuario.upsert({
    where: { email: 'voluntario@huellas.cl' },
    update: { nombre: 'Andrés Mendoza', rol: 'VOLUNTARIO_AVANZADO' },
    create: {
      email: 'voluntario@huellas.cl',
      password: hashedPassword,
      nombre: 'Andrés Mendoza',
      rol: 'VOLUNTARIO_AVANZADO'
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

  // 2. Caniles (18 caniles como en Prototipo.html)
  const canilesData = [];
  for (let i = 1; i <= 18; i++) {
    const isGato = i > 12;
    canilesData.push({
      codigo: `C-${i < 10 ? '0' + i : i}`,
      nombre: `Canil #${i}`,
      sector: isGato ? 'Gateras' : (i % 4 === 0 ? 'Cuarentena' : 'Patio Principal'),
      tipo: isGato ? 'Gato' : 'Perro',
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
    { nombre: 'Luna', especie: 'Perro', sexo: 'Hembra', edad: '1.5 años', raza: 'Mestizo', peso: 14.5, chip: 'ES-9831122', estadoSalud: 'NORMAL', nota: 'Sin novedad.', esterilizacion: 'SÍ (Operada)', comportamiento: 'Sociable, dócil, activa', creadoPorId: voluntario.id },
    { nombre: 'Bruno', especie: 'Perro', sexo: 'Macho', edad: '5 años', raza: 'Mestizo', peso: 22.0, chip: 'ES-1120987', estadoSalud: 'NORMAL', nota: 'Sin novedad. Paseos normales.', esterilizacion: 'SÍ (Operado)', comportamiento: 'Calmado, obediente', creadoPorId: voluntario.id },
    { nombre: 'Nala', especie: 'Gato', sexo: 'Hembra', edad: '4 meses', raza: 'Mestizo', peso: 1.8, estadoSalud: 'CONDICION_ESPECIAL', nota: 'En observación médica.', esterilizacion: 'NO', comportamiento: 'Tímida, en observación', creadoPorId: veterinaria.id },
    { nombre: 'Thor', especie: 'Perro', sexo: 'Macho', edad: '3 años', raza: 'Husky', peso: 24.0, chip: 'ES-7743201', estadoSalud: 'NORMAL', nota: 'Energético. Requiere paseos largos.', esterilizacion: 'SÍ (Operado)', comportamiento: 'Enérgico, paseos largos', creadoPorId: voluntario.id },
    { nombre: 'Simba', especie: 'Gato', sexo: 'Macho', edad: '6 años', raza: 'Naranja', peso: 5.2, estadoSalud: 'NORMAL', nota: 'Ideal para departamento.', esterilizacion: 'SÍ (Operado)', comportamiento: 'Muy tranquilo', creadoPorId: voluntario.id },
    { nombre: 'Canela', especie: 'Perro', sexo: 'Hembra', edad: '2 años', raza: 'Cocker', peso: 12.0, chip: 'ES-5528834', estadoSalud: 'CRITICO', nota: 'Tratamiento antibiótico estricto.', esterilizacion: 'NO', comportamiento: 'En recuperación delicada', creadoPorId: veterinaria.id },
    { nombre: 'Oreo', especie: 'Gato', sexo: 'Macho', edad: '1 año', raza: 'Mestizo', peso: 3.6, estadoSalud: 'NORMAL', nota: 'Juguetón sin restricciones.', esterilizacion: 'NO', comportamiento: 'Juguetón', creadoPorId: voluntario.id },
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

  // 5. Insumos con stocks críticos
  const insumos = [
    { nombre: 'Alimento seco perros 15kg', categoria: 'Alimento', stock: 18, stockMinimo: 10 },
    { nombre: 'Alimento húmedo gatos', categoria: 'Alimento', stock: 4, stockMinimo: 12 }, // Crítico
    { nombre: 'Amoxicilina 250mg', categoria: 'Medicamento', stock: 25, stockMinimo: 15 },
    { nombre: 'Ivermectina pipetas', categoria: 'Medicamento', stock: 2, stockMinimo: 8 }, // Crítico
    { nombre: 'Desinfectante caniles 5L', categoria: 'Higiene', stock: 3, stockMinimo: 6 }, // Crítico
    { nombre: 'Vendas elásticas', categoria: 'Higiene', stock: 15, stockMinimo: 5 }
  ];

  for (const ins of insumos) {
    const ex = await prisma.insumo.findFirst({ where: { nombre: ins.nombre } });
    if (!ex) {
      await prisma.insumo.create({ data: ins });
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

  // 7. Turnos (con turnos descubiertos para el indicador)
  const turnos = [
    { diaSemana: 'Lunes', franja: 'Mañana', area: 'Paseos', voluntario: 'Andrés Mendoza', cubierto: true },
    { diaSemana: 'Lunes', franja: 'Tarde', area: 'Clínica', voluntario: 'Diego Rivera', cubierto: true },
    { diaSemana: 'Martes', franja: 'Mañana', area: 'Limpieza', voluntario: 'María Portero', cubierto: true },
    { diaSemana: 'Martes', franja: 'Tarde', area: 'Paseos', voluntario: null, cubierto: false }, // Descubierto
    { diaSemana: 'Miércoles', franja: 'Mañana', area: 'Alimentación', voluntario: 'Sofía Valdés', cubierto: true },
    { diaSemana: 'Miércoles', franja: 'Tarde', area: 'Clínica', voluntario: null, cubierto: false }, // Descubierto
    { diaSemana: 'Jueves', franja: 'Mañana', area: 'Paseos', voluntario: null, cubierto: false }, // Descubierto
  ];

  for (const t of turnos) {
    const ex = await prisma.turno.findFirst({ where: { diaSemana: t.diaSemana, franja: t.franja, area: t.area } });
    if (!ex) {
      await prisma.turno.create({ data: t });
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