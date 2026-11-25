import { ErrorDominio } from '../utils/errorDominio.js';

export const ocupacionDeCanil = ({ animales, capacidad }) => ({
  alojados: animales.length, capacidad, libres: Math.max(0, capacidad - animales.length),
  porcentaje: Math.round(animales.length * 100 / capacidad)
});

export function validarIngresoAnimal({ animal, canil }) {
  if (animal.activo === false || animal.estadoAdopcion === 'ADOPTADO') throw new ErrorDominio(409, 'El animal está inactivo o adoptado.');
  if (canil.estado === 'MANTENIMIENTO') throw new ErrorDominio(409, 'El canil está en mantenimiento.');
  if (canil.estado === 'CUARENTENA' && animal.canilId !== canil.id) throw new ErrorDominio(409, 'El destino está en cuarentena.');
  if (canil.animales.filter(a => a.id !== animal.id).length >= canil.capacidad) throw new ErrorDominio(409, 'El canil ya no tiene cupos disponibles.');
}

export async function bloquearCaniles(tx, ...ids) {
  for (const id of [...new Set(ids.filter(Boolean))].sort((a,b) => a-b)) {
    await tx.$queryRaw`SELECT id FROM caniles WHERE id = ${id} FOR UPDATE`;
  }
}
export async function buscarCanil(tx, id) {
  const canil = await tx.canil.findUnique({ where: { id }, include: { animales: true } });
  if (!canil) throw new ErrorDominio(404, 'Canil no encontrado.');
  return canil;
}
export const contarAnimales = (tx, canilId) => tx.animal.count({ where: { canilId } });
export async function sincronizarEstadoCanil(tx, id) {
  if (!id) return null;
  await bloquearCaniles(tx, id);
  const canil = await tx.canil.findUnique({ where: { id } });
  if (canil.estado === 'MANTENIMIENTO') return canil;
  const activa = await tx.cuarentenaAnimal.findFirst({ where: { canilId: id, estado: 'ACTIVA' } });
  const estado = activa ? 'CUARENTENA' : await contarAnimales(tx, id) ? 'OCUPADO' : 'LIBRE';
  return tx.canil.update({ where: { id }, data: { estado } });
}
export async function registrarMovimiento(tx, animal, destino, responsableId, motivo) {
  if (animal.canilId === destino) return;
  await tx.traslado.create({ data: { animalId: animal.id, tipo: 'INTERNO_CANIL', estado: 'COMPLETADO',
    canilOrigenId: animal.canilId, canilDestinoId: destino, responsableId, motivo } });
}
export async function validarSalida(tx, animalId) {
  if (await tx.animal.findFirst({ where: { id: animalId, canil: { estado: 'CUARENTENA' } } }))
    throw new ErrorDominio(409, 'Completa y finaliza la cuarentena antes de mover al animal.');
  if (await tx.cuarentenaAnimal.findFirst({ where: { animalId, estado: 'ACTIVA' } }))
    throw new ErrorDominio(409, 'Finaliza la cuarentena antes de mover o liberar al animal.');
}
