import prisma from '../config/prisma.js';
import { registrarAuditoria } from './audit.service.js';

export const getPostulantes = async () => {
  return await prisma.postulante.findMany({
    where: { activo: true },
    include: {
      adopciones: {
        include: {
          animal: { select: { id: true, nombre: true, especie: true } }
        }
      }
    },
    orderBy: { creadoEn: 'desc' }
  });
};

export const createPostulante = async (data, user, ip) => {
  const nuevo = await prisma.postulante.create({ data });

  await registrarAuditoria({
    entidad: 'Postulante',
    entidadId: nuevo.id,
    accion: 'CREACION',
    valorAnterior: null,
    valorNuevo: nuevo,
    usuario: user,
    ip
  });

  return nuevo;
};

export const updatePostulante = async (id, data, user, ip) => {
  const anterior = await prisma.postulante.findUnique({ where: { id: Number(id) } });
  if (!anterior) throw new Error('Postulante no encontrado');

  const actualizado = await prisma.postulante.update({
    where: { id: Number(id) },
    data
  });

  await registrarAuditoria({
    entidad: 'Postulante',
    entidadId: actualizado.id,
    accion: 'MODIFICACION',
    valorAnterior: anterior,
    valorNuevo: actualizado,
    usuario: user,
    ip
  });

  return actualizado;
};

export const deletePostulante = async (id, user, ip) => {
  const anterior = await prisma.postulante.findUnique({ where: { id: Number(id) } });
  if (!anterior) throw new Error('Postulante no encontrado');

  const baja = await prisma.postulante.update({
    where: { id: Number(id) },
    data: { activo: false }
  });

  await registrarAuditoria({
    entidad: 'Postulante',
    entidadId: baja.id,
    accion: 'BAJA_LOGICA',
    valorAnterior: anterior,
    valorNuevo: { activo: false },
    usuario: user,
    ip
  });

  return baja;
};
