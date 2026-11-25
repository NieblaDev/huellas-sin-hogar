import prisma from '../config/prisma.js';
import { getCanil } from './canil.service.js';
import { diasEntre } from '../utils/fechas.js';
import { etiquetaRolUsuario } from '../constants/usuarios.js';

export function calcularEstadias(id, eventos, actuales) {
  const abiertas = new Map();
  const estadias = [];
  for (const t of eventos) {
    if (t.canilOrigenId === t.canilDestinoId) continue;
    if (t.canilDestinoId === id) abiertas.set(t.animal.id, t.fechaRegistro);
    else {
      const desde = abiertas.get(t.animal.id) || t.animal.creadoEn;
      estadias.push({ animal: t.animal, desde, hasta: t.fechaRegistro, dias: diasEntre(desde, t.fechaRegistro), actual: false });
      abiertas.delete(t.animal.id);
    }
  }
  for (const animal of actuales) {
    const desde = animal.fechaIngresoCanil || abiertas.get(animal.id) || animal.creadoEn;
    estadias.push({ animal, desde, hasta: null, dias: diasEntre(desde), actual: true });
  }
  return estadias.reverse();
}
export async function historialCanil(id, { limit, cursor }) {
  const { animales: ocupantes, codigo, nombre, sector, capacidad, tipo } = await getCanil(id);
  const canil = { id, codigo, nombre, sector, capacidad, tipo };
  const animales = ocupantes.map(({id,nombre,especie,fotoUrl,fechaIngresoCanil,creadoEn}) => ({id,nombre,especie,fotoUrl,fechaIngresoCanil,creadoEn}));
  const animal = { select: { id: true, nombre: true, especie: true, fotoUrl: true, creadoEn: true } };
  const eventos = await prisma.traslado.findMany({
    where: { tipo: 'INTERNO_CANIL', OR: [{ canilOrigenId: id }, { canilDestinoId: id }] },
    orderBy: [{ fechaRegistro: 'asc' }, { id: 'asc' }],
    include: { animal, responsable: { select: { id: true, nombre: true, sexo: true, rol: true } },
      canilOrigen: { select: { nombre: true } }, canilDestino: { select: { nombre: true } } }
  });
  const estadias = calcularEstadias(id, eventos, animales);
  const ordenados = eventos.filter(t => !cursor || t.id < cursor).sort((a,b) => b.id-a.id);
  const movimientos = ordenados.slice(0, limit).map(t => ({ id: t.id, fecha: t.fechaRegistro,
    animal: t.animal, origen: t.canilOrigen?.nombre, destino: t.canilDestino?.nombre, motivo: t.motivo,
    responsable: { id: t.responsable.id, nombre: t.responsable.nombre, rolEtiqueta: etiquetaRolUsuario(t.responsable.rol, t.responsable.sexo) } }));
  const cuarentenas = await prisma.cuarentenaAnimal.findMany({ where: { canilId: id }, include: { animal }, orderBy: { fechaInicio: 'desc' } });
  const dias = estadias.map(e => e.dias).filter(n => n !== null);
  return { canil, estadias, movimientos, cuarentenas: cuarentenas.map(q => ({ ...q, dias: diasEntre(q.fechaInicio, q.fechaFinReal || new Date()) })),
    resumen: { residentes: new Set(estadias.map(e => e.animal.id)).size, estadiasActuales: animales.length,
      promedioDias: dias.length ? Math.round(dias.reduce((s,n) => s+n,0)/dias.length) : 0, movimientos: eventos.length },
    paginacion: { limit, nextCursor: ordenados.length > limit ? movimientos.at(-1).id : null } };
}
