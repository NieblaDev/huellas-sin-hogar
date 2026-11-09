import { z } from 'zod';

export const actualizarEtapaSchema = z.object({
  accion: z.enum(['EVALUAR', 'AGENDAR_VISITA', 'REGISTRAR_VISITA', 'OMITIR_VISITA', 'APROBAR', 'RECHAZAR', 'CANCELAR', 'ENTREGAR']),
  resultadoEvaluacion: z.enum(['CUMPLE', 'NO_CUMPLE', 'PENDIENTE']).optional(),
  fecha: z.string().datetime({ offset: true, message: 'Indica una fecha y hora válidas.' }),
  observaciones: z.string().trim().min(3, 'Escribe al menos 3 caracteres.').max(4000),
  motivoOmision: z.string().trim().min(3, 'Indica el motivo de omisión (mínimo 3 caracteres).').max(2000).optional(),
  actualizadoEn: z.string().datetime()
}).strict().superRefine((data, ctx) => {
  if (data.accion === 'EVALUAR' && !data.resultadoEvaluacion) ctx.addIssue({ code: 'custom', path: ['resultadoEvaluacion'], message: 'Selecciona el resultado: cumple, no cumple o pendiente de información.' });
  if (data.accion !== 'EVALUAR' && data.resultadoEvaluacion !== undefined) ctx.addIssue({ code: 'custom', path: ['resultadoEvaluacion'], message: 'El resultado solo corresponde a una evaluación.' });
  if (data.accion === 'OMITIR_VISITA' && !data.motivoOmision) ctx.addIssue({ code: 'custom', path: ['motivoOmision'], message: 'Debes indicar por qué se omite la visita al hogar.' });
  if (data.accion !== 'OMITIR_VISITA' && data.motivoOmision !== undefined) ctx.addIssue({ code: 'custom', path: ['motivoOmision'], message: 'El motivo solo corresponde a una omisión de visita.' });
});
