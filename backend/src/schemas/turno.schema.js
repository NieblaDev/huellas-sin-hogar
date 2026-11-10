import { z } from 'zod';

export const crearTurnoSchema = z.object({
  diaSemana: z.string().min(3, 'El día de la semana es requerido (ej: Lunes, Martes)'),
  franja: z.string().min(2, 'La franja horaria es requerida (ej: Mañana, Tarde)'),
  area: z.string().min(2, 'El área de servicio es obligatoria (ej: Paseos, Limpieza, Atención Veterinaria)'),
  fecha: z.string().datetime({ message: 'La fecha debe ser una cadena ISO válida' }).optional().nullable(),
  esCritica: z.boolean().default(false),
  cupoMaximo: z.number().int().min(1, 'El cupo mínimo debe ser de al menos 1 voluntario').default(2),
  horaInicio: z.string().optional().nullable(),
  horaFin: z.string().optional().nullable(),
  observaciones: z.string().optional().nullable()
});

export const actualizarTurnoSchema = z.object({
  diaSemana: z.string().min(3).optional(),
  franja: z.string().min(2).optional(),
  area: z.string().min(2).optional(),
  fecha: z.string().datetime().optional().nullable(),
  esCritica: z.boolean().optional(),
  cupoMaximo: z.number().int().min(1).optional(),
  horaInicio: z.string().optional().nullable(),
  horaFin: z.string().optional().nullable(),
  observaciones: z.string().optional().nullable()
});

export const inscribirTurnoSchema = z.object({
  usuarioId: z.number().int().positive().optional().nullable()
});

export const solicitarPermutaSchema = z.object({
  turnoOrigenId: z.number().int().positive('Debe indicar el turno de origen que desea permutar'),
  destinatarioId: z.number().int().positive('Debe seleccionar el voluntario destinatario'),
  turnoDestinoId: z.number().int().positive().optional().nullable(),
  motivo: z.string().min(5, 'Debe ingresar una justificación para la permuta (mínimo 5 caracteres)')
});

export const responderPermutaSchema = z.object({
  accion: z.enum(['APROBAR', 'RECHAZAR'], {
    errorMap: () => ({ message: 'La acción debe ser APROBAR o RECHAZAR' })
  }),
  observacion: z.string().optional().nullable()
});

export const registrarBitacoraSchema = z.object({
  tareasRealizadas: z.string().min(5, 'Debe describir las tareas realizadas durante el turno (mínimo 5 caracteres)'),
  incidentes: z.string().optional().nullable(),
  observaciones: z.string().optional().nullable()
});
