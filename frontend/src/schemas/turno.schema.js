import { z } from 'zod';
import { idSeleccion, numeroFormulario, opcional, texto } from './campos.js';

export const turnoSchema = z.object({
  diaSemana: texto(3),
  franja: texto(2),
  area: texto(2),
  cupoMaximo: numeroFormulario(1, true),
  esCritica: z.boolean(),
  observaciones: opcional()
});

export const permutaSchema = z.object({
  turnoOrigenId: idSeleccion,
  destinatarioId: idSeleccion,
  turnoDestinoId: z.union([z.literal(''), idSeleccion]).optional(),
  motivo: texto(5)
});

export const bitacoraSchema = z.object({
  tareasRealizadas: texto(5),
  incidentes: opcional(),
  observaciones: opcional()
});

export const asignarVoluntarioSchema = z.object({ voluntarioAAsignarId: idSeleccion });
