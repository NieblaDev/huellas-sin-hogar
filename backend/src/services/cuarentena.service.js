import prisma from '../config/prisma.js';
import { ErrorDominio } from '../utils/errorDominio.js';
import { registrarAuditoria } from './audit.service.js';
import { bloquearCaniles, sincronizarEstadoCanil } from './canilOcupacion.js';

export async function iniciarCuarentena(tx, { animal, canil, motivo, fechaFinEstimada, observaciones, canilAislamiento, user, ip }) {
  const fin = new Date(fechaFinEstimada);
  if (!motivo?.trim() || motivo.trim().length < 5 || !(fin > new Date())) throw new ErrorDominio(400, 'Ingresa un motivo de al menos cinco caracteres y una fecha de término futura.');
  if (canil && (canil.capacidad !== 1 || canil.estado === 'MANTENIMIENTO')) throw new ErrorDominio(409, 'La cuarentena requiere un canil individual disponible.');
  if (await tx.cuarentenaAnimal.findFirst({ where: { animalId: animal.id, estado: 'ACTIVA' } })) throw new ErrorDominio(409, 'El animal ya tiene una cuarentena activa.');
  const registro = await tx.cuarentenaAnimal.create({ data: { animalId: animal.id, canilId: canil?.id, canilAislamiento: canilAislamiento || canil?.nombre, motivo, fechaFinEstimada: fin, observaciones } });
  await sincronizarEstadoCanil(tx, canil?.id);
  await registrarAuditoria({ entidad: 'CuarentenaAnimal', entidadId: registro.id, accion: 'CREACION', valorNuevo: registro, usuario: user, ip }, tx);
  return registro;
}

export const finalizarCuarentena = ({ canilId, animalId, observaciones, user, ip }) => prisma.$transaction(async tx => {
  await bloquearCaniles(tx, canilId);
  const anterior = await tx.cuarentenaAnimal.findFirst({ where: { canilId, animalId, estado: 'ACTIVA' }, orderBy: { id: 'asc' } });
  if (!anterior) throw new ErrorDominio(404, 'No hay una cuarentena activa en este canil.');
  const cuarentena = await tx.cuarentenaAnimal.update({ where: { id: anterior.id }, data: { estado: 'FINALIZADA', fechaFinReal: new Date(), observaciones: [anterior.observaciones, observaciones].filter(Boolean).join('\n') || null } });
  const canil = await sincronizarEstadoCanil(tx, canilId);
  await registrarAuditoria({ entidad: 'CuarentenaAnimal', entidadId: cuarentena.id, accion: 'MODIFICACION', valorAnterior: anterior, valorNuevo: cuarentena, usuario: user, ip }, tx);
  return { success: true, mensaje: 'Cuarentena finalizada.', canil, cuarentena };
});
