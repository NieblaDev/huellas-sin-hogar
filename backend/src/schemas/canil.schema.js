import { z } from 'zod';

export const asignarCanilSchema = z.object({
  canilId: z.number().int().positive('ID de canil inválido'),
  animalId: z.number().int().positive('ID de animal inválido').nullable().optional(),
  motivo: z.string().min(3, 'El motivo del movimiento es obligatorio'),
  estado: z.enum(['LIBRE', 'OCUPADO', 'CUARENTENA', 'MANTENIMIENTO']).default('OCUPADO')
});

export const trasladoExternoSchema = z.object({
  animalId: z.number().int().positive('ID de animal obligatorio'),
  tipo: z.enum(['PROTECTORA_ALIADA', 'HOGAR_TEMPORAL']),
  motivo: z.string().min(3, 'El motivo del traslado es obligatorio'),
  destinoNombre: z.string().min(2, 'El nombre del destino es obligatorio'),
  destinoContacto: z.string().optional().nullable(),
  destinoDireccion: z.string().optional().nullable()
});

export const gestionAprobacionSchema = z.object({
  aprobar: z.boolean(),
  comentario: z.string().optional().nullable()
});
