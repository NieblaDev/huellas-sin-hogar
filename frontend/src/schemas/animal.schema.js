import { z } from 'zod';
import { idSeleccion, numeroFormulario, opcional, texto } from './campos.js';

export const fichaAnimalSchema = z.object({
  nombre: texto(),
  especie: z.enum(['Perro', 'Gato'], { errorMap: () => ({ message: 'Selecciona una especie.' }) }),
  sexo: z.enum(['Macho', 'Hembra'], { errorMap: () => ({ message: 'Selecciona el sexo.' }) }),
  tipoIngreso: z.enum(['Rescate', 'Abandono', 'Decomiso']),
  peso: z.union([z.literal(''), numeroFormulario(0)]).optional(),
  edad: opcional(),
  raza: opcional(),
  chip: opcional(),
  comportamiento: opcional(),
  esterilizacion: opcional(),
  nota: opcional(),
  estadoSalud: z.enum(['NORMAL', 'CONDICION_ESPECIAL', 'CRITICO']),
  estadoAdopcion: z.enum(['EN_REFUGIO', 'ADOPTADO']).optional(),
  canilId: z.union([z.literal(''), idSeleccion]).optional()
});
