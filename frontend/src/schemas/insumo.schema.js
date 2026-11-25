import { z } from 'zod';
import { fechaOpcional, idSeleccion, numeroFormulario, opcional, texto } from './campos.js';

export const insumoSchema = z.object({
  nombre: texto(2),
  categoria: texto(2),
  stock: numeroFormulario(0, true),
  stockMinimo: numeroFormulario(0, true),
  unidad: texto(),
  esFarmaco: z.boolean(),
  ubicacion: opcional(),
  lote: opcional(),
  fechaVencimiento: fechaOpcional
});

const subtipos = {
  ENTRADA: ['DONACION', 'COMPRA', 'AJUSTE'],
  SALIDA: ['CONSUMO', 'TRATAMIENTO_MEDICO', 'MERMA', 'AJUSTE']
};

export const movimientoSchema = z.object({
  insumoId: idSeleccion,
  tipo: z.enum(['ENTRADA', 'SALIDA']),
  subtipo: texto(),
  cantidad: numeroFormulario(1, true),
  motivo: texto(3),
  donanteOProveedor: opcional(),
  animalId: z.union([z.literal(''), idSeleccion]).optional(),
  lote: opcional(),
  fechaVencimiento: fechaOpcional
}).refine(datos => subtipos[datos.tipo].includes(datos.subtipo), {
  path: ['subtipo'], message: 'Selecciona un motivo que corresponda al tipo de movimiento.'
});
