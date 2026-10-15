import prisma from '../config/prisma.js';
import { registrarAuditoria } from './audit.service.js';

export const getInsumos = async () => {
  return await prisma.insumo.findMany({
    where: { activo: true },
    orderBy: { nombre: 'asc' }
  });
};

export const createInsumo = async (data, user, ip) => {
  const nuevo = await prisma.insumo.create({
    data
  });

  await registrarAuditoria({
    entidad: 'Inventario',
    entidadId: nuevo.id,
    accion: 'CREACION',
    valorAnterior: null,
    valorNuevo: nuevo,
    usuario: user,
    ip
  });

  return nuevo;
};

export const updateInsumo = async (id, data, user, ip) => {
  const anterior = await prisma.insumo.findUnique({ where: { id: Number(id) } });
  if (!anterior) throw new Error('Insumo no encontrado');

  const actualizado = await prisma.insumo.update({
    where: { id: Number(id) },
    data
  });

  await registrarAuditoria({
    entidad: 'Inventario',
    entidadId: actualizado.id,
    accion: 'MODIFICACION',
    valorAnterior: anterior,
    valorNuevo: actualizado,
    usuario: user,
    ip
  });

  return actualizado;
};

export const deleteInsumo = async (id, user, ip) => {
  const anterior = await prisma.insumo.findUnique({ where: { id: Number(id) } });
  if (!anterior) throw new Error('Insumo no encontrado');

  const baja = await prisma.insumo.update({
    where: { id: Number(id) },
    data: { activo: false }
  });

  await registrarAuditoria({
    entidad: 'Inventario',
    entidadId: baja.id,
    accion: 'BAJA_LOGICA',
    valorAnterior: anterior,
    valorNuevo: { activo: false },
    usuario: user,
    ip
  });

  return baja;
};
