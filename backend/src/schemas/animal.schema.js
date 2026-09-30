import { z } from 'zod';
export const createAnimalSchema = z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  especie: z.enum(['Perro', 'Gato']),
  sexo: z.enum(['Macho', 'Hembra']),
  edad: z.string().min(1, 'La edad es obligatoria'),
  raza: z.string().optional().default('Mestizo'),
  peso: z.number().nonnegative().default(0),
  chip: z.string().optional().nullable(),
  estadoSalud: z.enum(['NORMAL', 'CONDICION_ESPECIAL', 'CRITICO']).default('NORMAL'),
  nota: z.string().optional().default('Sin notas.'),
  fotoUrl: z.string().optional().nullable(),
  esterilizacion: z.string().optional().default('NO'),
  comportamiento: z.string().optional().default('Por evaluar')
});