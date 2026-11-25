import { z } from 'zod';
import { fecha, idSeleccion, opcional, texto } from './campos.js';

export const indicacionSchema = z.object({
  animalId: idSeleccion,
  contexto: z.enum(['EVALUACION_CLINICA', 'CIRUGIA', 'INGRESO_REFUGIO']),
  categoria: z.enum(['DIETA_ESPECIAL', 'MEDICACION_ORAL', 'RESTRICCION_FISICA', 'HIGIENE_CURACION', 'OBSERVACION_CONDUCTA']),
  criticidad: z.enum(['CRITICA', 'ALTA', 'MEDIA', 'BAJA']),
  titulo: texto(3),
  instruccion: texto(5),
  franjaHoraria: z.enum(['Mañana', 'Tarde', 'Ambas']),
  fechaInicio: fecha,
  fechaFin: fecha
}).refine(datos => datos.fechaFin >= datos.fechaInicio, {
  path: ['fechaFin'], message: 'La fecha de término no puede ser anterior a la fecha de inicio.'
});

export const cumplimientoSchema = z.object({ texto: opcional(4000) });
