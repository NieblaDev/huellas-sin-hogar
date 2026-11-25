import { z } from 'zod';

export const crearInsumoSchema = z.object({
  nombre: z.string().min(2, 'El nombre del insumo debe tener al menos 2 caracteres'),
  categoria: z.string().min(2, 'La categoría es obligatoria'),
  stock: z.number().int('El stock debe ser un número entero').min(0, 'El stock inicial no puede ser negativo'),
  stockMinimo: z.number().int('El stock mínimo debe ser un número entero').min(0, 'El stock mínimo no puede ser negativo').default(5),
  unidad: z.string().min(1, 'La unidad de medida es requerida').default('Unidades'),
  esFarmaco: z.boolean().default(false),
  fechaVencimiento: z.string().datetime({ message: 'La fecha de vencimiento debe ser válida' }).optional().nullable(),
  lote: z.string().optional().nullable(),
  ubicacion: z.string().optional().nullable()
});

export const actualizarInsumoSchema = crearInsumoSchema.partial();

export const registrarMovimientoSchema = z.object({
  tipo: z.enum(['ENTRADA', 'SALIDA'], {
    errorMap: () => ({ message: 'Selecciona si el movimiento es una entrada o una salida.' })
  }),
  subtipo: z.enum(['DONACION', 'COMPRA', 'CONSUMO', 'TRATAMIENTO_MEDICO', 'MERMA', 'AJUSTE'], {
    errorMap: () => ({ message: 'Selecciona un motivo válido para el movimiento.' })
  }),
  cantidad: z.number().int('La cantidad debe ser un número entero').positive('La cantidad debe ser mayor a 0'),
  motivo: z.string().min(3, 'El motivo o justificación del movimiento es obligatorio (mínimo 3 caracteres)'),
  donanteOProveedor: z.string().optional().nullable(),
  animalId: z.number().int().positive().optional().nullable(),
  tratamientoId: z.number().int().positive().optional().nullable(),
  lote: z.string().optional().nullable(),
  fechaVencimiento: z.string().datetime({ message: 'La fecha de vencimiento debe ser válida' }).optional().nullable()
}).refine(data => {
  // Coherencia entre tipo y subtipo
  if (data.tipo === 'ENTRADA') {
    return ['DONACION', 'COMPRA', 'AJUSTE'].includes(data.subtipo);
  }
  if (data.tipo === 'SALIDA') {
    return ['CONSUMO', 'TRATAMIENTO_MEDICO', 'MERMA', 'AJUSTE'].includes(data.subtipo);
  }
  return true;
}, {
  message: 'El motivo seleccionado no corresponde a este tipo de movimiento.',
  path: ['subtipo']
});

export const listarInsumosSchema = z.object({ search: z.string().optional(), categoria: z.string().optional() });
