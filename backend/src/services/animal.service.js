import prisma from '../config/prisma.js';

export const getAllAnimals = async ({ especie, estadoSalud, search }) => {
  const where = {};
  if (especie) where.especie = especie;
  if (estadoSalud) where.estadoSalud = estadoSalud;
  if (search) where.nombre = { contains: search, mode: 'insensitive' };

  return await prisma.animal.findMany({ where, orderBy: { creadoEn: 'desc' } });
};

export const createAnimal = async (data, userId) => {
  return await prisma.animal.create({
    data: {
      ...data,
      creadoPorId: userId || null
    }
  });
};

export const deleteAnimal = async (id) => {
  return await prisma.animal.delete({
    where: { id: Number(id) }
  });
};