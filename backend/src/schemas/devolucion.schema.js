import { z } from 'zod';

export const registrarDevolucionSchema = z.object({
  adopcionId: z.number().int().positive().max(2147483647),
  fecha: z.string().datetime({ offset: true, message: 'Indica una fecha y hora válidas para la devolución.' }),
  motivo: z.string().trim().min(5, 'Explica el motivo de la devolución con al menos 5 caracteres.').max(4000, 'El motivo admite hasta 4000 caracteres.'),
  estadoAnimal: z.string().trim().min(3, 'Describe el estado de salud y condición del animal al reingreso (mínimo 3 caracteres).').max(4000, 'El estado del animal admite hasta 4000 caracteres.'),
  observacionesPostulante: z.string().trim().max(4000, 'Las observaciones sobre el postulante admiten hasta 4000 caracteres.').optional(),
  canilId: z.number().int().positive().max(2147483647).optional(),
  actualizadoEn: z.string().datetime({ message: 'Indica la fecha de actualización de la adopción.' }).optional()
}).strict();

export const devolucionIdSchema = z.object({
  id: z.coerce.number().int().positive().max(2147483647)
}).strict();

export const listarDevolucionesSchema = z.object({
  postulanteId: z.coerce.number().int().positive().max(2147483647).optional(),
  animalId: z.coerce.number().int().positive().max(2147483647).optional(),
  pagina: z.coerce.number().int().min(1).max(1000000).default(1),
  limite: z.coerce.number().int().min(1).max(50).default(20)
}).strict();
