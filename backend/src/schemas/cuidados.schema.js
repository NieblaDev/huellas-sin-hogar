import { z } from 'zod';

export const crearIndicacionSchema = z.object({
  animalId: z.number().int().positive('Debe seleccionar un animal válido'),
  contexto: z.enum(['EVALUACION_CLINICA', 'CIRUGIA', 'INGRESO_REFUGIO'], {
    errorMap: () => ({ message: 'Debe indicar el contexto clínico (evaluación, cirugía o ingreso)' })
  }),
  categoria: z.enum([
    'DIETA_ESPECIAL',
    'MEDICACION_ORAL',
    'RESTRICCION_FISICA',
    'HIGIENE_CURACION',
    'OBSERVACION_CONDUCTA'
  ]),
  criticidad: z.enum(['CRITICA', 'ALTA', 'MEDIA', 'BAJA'], {
    errorMap: () => ({ message: 'Debe seleccionar un nivel de criticidad válido' })
  }),
  titulo: z.string().min(3, 'El título de la indicación es obligatorio'),
  instruccion: z.string().min(5, 'El detalle operativo de la nota de cuidado es obligatorio'),
  franjaHoraria: z.enum(['Mañana', 'Tarde', 'Ambas']),
  fechaInicio: z.string().datetime({ message: 'La fecha de inicio debe ser válida' }),
  fechaFin: z.string().datetime({ message: 'La fecha de término debe ser válida' })
}).refine((data) => new Date(data.fechaFin) >= new Date(data.fechaInicio), {
  message: 'La fecha de término no puede ser anterior a la fecha de inicio',
  path: ['fechaFin']
});

export const marcarTareaCompletadaSchema = z.object({
  indicacionId: z.number().int().positive(),
  observaciones: z.string().optional().nullable()
});