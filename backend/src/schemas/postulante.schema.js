import { z } from 'zod';

export const crearPostulanteSchema = z.object({
  nombre: z.string().trim().min(1).max(100),
  rut: z.string().trim().min(3).max(20),
  tipoIdentificacion: z.enum(['RUT', 'OTRO']).optional(),
  telefono: z.string().trim().max(40).nullish(),
  email: z.union([z.string().trim().email().max(120), z.literal('')]).nullish(),
  direccion: z.string().trim().max(200).nullish(),
  activo: z.boolean().optional()
}).strict();

export const actualizarPostulanteSchema = crearPostulanteSchema.partial();
