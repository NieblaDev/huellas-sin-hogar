import prisma from '../config/prisma.js';
import { registrarAuditoria } from './audit.service.js';

export const getAllAnimals = async ({ especie, estadoSalud, search }) => {
  const where = { activo: true };
  if (especie) where.especie = especie;
  if (estadoSalud) where.estadoSalud = estadoSalud;
  if (search) where.nombre = { contains: search, mode: 'insensitive' };

  return await prisma.animal.findMany({
    where,
    include: {
      canil: {
        select: { id: true, codigo: true, nombre: true, sector: true, estado: true }
      }
    },
    orderBy: { creadoEn: 'desc' }
  });
};

export const createAnimal = async (data, user, ip) => {
  const { canilId, ...animalData } = data;

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

  const newAnimal = await prisma.animal.create({
    data: {
      ...animalData,
      canilId: canilId ? Number(canilId) : null,
      creadoPorId: user?.id || null
    },
    include: { canil: true }
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
        motivo: 'Asignación de canil en ingreso al refugio',
        estado: 'COMPLETADO',
        canilDestinoId: canilParaAsignar.id,
        responsableId: user.id
      }
    });
  }

  // Trazabilidad / Auditoría automática
  await registrarAuditoria({
    entidad: 'Animal',
    entidadId: newAnimal.id,
    accion: 'CREACION',
    valorAnterior: null,
    valorNuevo: newAnimal,
    usuario: user,
    ip
  });

  return newAnimal;
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

  return actualizado;
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