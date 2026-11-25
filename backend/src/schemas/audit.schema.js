import { idNumerico, fechaConsulta } from './request.schema.js';
import { z } from 'zod';

export const listarAuditoriasSchema = z.object({
  usuarioResponsable: z.string().optional(),
  entidad: z.string().optional(),
  fechaDesde: fechaConsulta.optional(),
  fechaHasta: fechaConsulta.optional(),
  limit: idNumerico.optional(),
  page: idNumerico.optional()
});
