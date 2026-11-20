import { z } from 'zod';

export const asignarCanilSchema = z.object({
  canilId: z.number().int().positive('Debe seleccionar un canil válido'),
  animalId: z.number().int().positive('Debe seleccionar un animal válido').nullable().optional(),
  motivo: z.string().min(3, 'El motivo del movimiento es obligatorio').optional().nullable(),
  estado: z.enum(['LIBRE', 'OCUPADO', 'CUARENTENA', 'MANTENIMIENTO']).default('OCUPADO')
});

export const trasladoExternoSchema = z.object({
  animalId: z.number().int().positive('Debe seleccionar un animal válido para el traslado'),
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

export const crearCanilSchema = z.object({
  codigo: z.string().min(1, 'El código del canil es obligatorio'),
  nombre: z.string().min(1, 'El nombre del canil es obligatorio'),
  sector: z.string().optional().nullable(),
  tipo: z.string().optional().nullable(),
  capacidad: z.number().int().positive('Capacidad inválida').optional().default(1),
  estado: z.enum(['LIBRE', 'OCUPADO', 'CUARENTENA', 'MANTENIMIENTO']).optional().default('LIBRE')
});

export const eliminarCanilSchema = z.object({
  id: z.string().regex(/^\d+$/, 'Selecciona un canil válido.').transform(Number)
});

export const canilIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/, 'Selecciona un canil válido.').transform(Number)
});

export const actualizarSectorCanilSchema = z.object({
  sector: z.string().trim().min(1, 'El sector es obligatorio').max(100, 'El sector no puede superar los 100 caracteres')
});
