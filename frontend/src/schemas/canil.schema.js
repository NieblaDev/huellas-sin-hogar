import { z } from 'zod';
import { idSeleccion, opcional, texto } from './campos.js';

export const crearCanilSchema = z.object({ sector: texto(1, 60), capacidad: z.coerce.number().int().min(1).max(20).default(1) });
export const gestionarCanilSchema = z.object({
  sectorEdicion: crearCanilSchema.shape.sector,
  selectedAnimalId: z.union([z.literal(''), idSeleccion]),
  enCuarentena: z.boolean(),
  motivoMovimiento: z.union([z.literal(''), texto(3)])
});
export const trasladoSchema = z.object({
  animalId: idSeleccion,
  tipo: z.enum(['PROTECTORA_ALIADA', 'HOGAR_TEMPORAL']),
  motivo: texto(3),
  destinoNombre: texto(2),
  destinoContacto: opcional(),
  destinoEmail: z.string().trim().pipe(z.union([
    z.literal(''), z.string().max(254).email('Ingresa un correo electrónico válido.')
  ])).optional(),
  destinoDireccion: opcional()
});

export const aprobacionTrasladoSchema = z.object({
  aprobar: z.boolean(), comentario: texto(0, 4000)
}).refine(datos => datos.aprobar || datos.comentario.length > 0, {
  path: ['comentario'], message: 'Indica el motivo del rechazo.'
});
