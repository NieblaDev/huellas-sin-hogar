import { z } from 'zod';
import { fecha, idSeleccion, numeroFormulario, opcional, texto } from './campos.js';

export const vacunaSchema = z.object({
  animalId: idSeleccion,
  nombreVacuna: texto(2),
  dosis: texto(),
  lote: opcional(),
  fechaVencimiento: fecha,
  observaciones: opcional()
});

export const atencionSchema = z.object({
  animalId: idSeleccion,
  motivo: texto(3),
  diagnostico: texto(5),
  temperatura: z.union([z.literal(''), numeroFormulario()]).optional(),
  pesoActual: z.union([z.literal(''), numeroFormulario().refine(valor => Number(valor) > 0, 'El peso debe ser mayor a cero.')]).optional()
});
