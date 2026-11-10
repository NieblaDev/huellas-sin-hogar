import { z } from 'zod';

export const crearInsumoSchema = z.object({
  nombre: z.string().min(2, 'El nombre del insumo debe tener al menos 2 caracteres'),
  categoria: z.string().min(2, 'La categoría es obligatoria'),
  stock: z.number().int('El stock debe ser un número entero').min(0, 'El stock inicial no puede ser negativo'),
  stockMinimo: z.number().int('El stock mínimo debe ser un número entero').min(0, 'El stock mínimo no puede ser negativo').default(5),
  unidad: z.string().min(1, 'La unidad de medida es requerida').default('Unidades'),
  esFarmaco: z.boolean().default(false),
  fechaVencimiento: z.string().datetime({ message: 'La fecha de vencimiento debe ser una fecha válida ISO' }).optional().nullable(),
  lote: z.string().optional().nullable(),
  ubicacion: z.string().optional().nullable()
});

export const actualizarInsumoSchema = z.object({
  nombre: z.string().min(2, 'El nombre del insumo debe tener al menos 2 caracteres').optional(),
  categoria: z.string().min(2, 'La categoría es obligatoria').optional(),
  stock: z.number().int('El stock debe ser un número entero').min(0, 'El stock no puede ser negativo').optional(),
  stockMinimo: z.number().int('El stock mínimo debe ser un número entero').min(0, 'El stock mínimo no puede ser negativo').optional(),
  unidad: z.string().min(1).optional(),
  esFarmaco: z.boolean().optional(),
  fechaVencimiento: z.string().datetime().optional().nullable(),
  lote: z.string().optional().nullable(),
  ubicacion: z.string().optional().nullable()
});

export const registrarMovimientoSchema = z.object({
  tipo: z.enum(['ENTRADA', 'SALIDA'], {
    errorMap: () => ({ message: 'El tipo de movimiento debe ser ENTRADA o SALIDA' })
  }),
  subtipo: z.enum(['DONACION', 'COMPRA', 'CONSUMO', 'TRATAMIENTO_MEDICO', 'MERMA', 'AJUSTE'], {
    errorMap: () => ({ message: 'Debe especificar una clasificación válida (DONACION, COMPRA, CONSUMO, TRATAMIENTO_MEDICO, MERMA o AJUSTE)' })
  }),
  cantidad: z.number().int('La cantidad debe ser un número entero').positive('La cantidad debe ser mayor a 0'),
  motivo: z.string().min(3, 'El motivo o justificación del movimiento es obligatorio (mínimo 3 caracteres)'),
  donanteOProveedor: z.string().optional().nullable(),
  animalId: z.number().int().positive().optional().nullable(),
  tratamientoId: z.number().int().positive().optional().nullable(),
  lote: z.string().optional().nullable(),
  fechaVencimiento: z.string().datetime({ message: 'La fecha de vencimiento debe ser una fecha ISO válida' }).optional().nullable()
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
  message: 'El subtipo seleccionado no corresponde con el tipo de movimiento (ENTRADA o SALIDA)',
  path: ['subtipo']
});
