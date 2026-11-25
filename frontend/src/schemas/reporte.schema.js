import { z } from 'zod';
import { fechaOpcional } from './campos.js';

export const reporteSchema = z.object({
  fechaDesde: fechaOpcional,
  fechaHasta: fechaOpcional,
  formato: z.enum(['PDF', 'CSV']),
  tipoInformacion: z.enum(['TODOS', 'INGRESOS', 'ADOPCIONES', 'DEVOLUCIONES', 'CENSO', 'INSUMOS']),
  especie: z.string().optional(),
  estadoSalud: z.string().optional(),
  tipoIngreso: z.string().optional()
}).refine(datos => !datos.fechaDesde || !datos.fechaHasta || datos.fechaDesde <= datos.fechaHasta, {
  path: ['fechaHasta'], message: 'La fecha de término debe ser posterior o igual a la de inicio.'
});
