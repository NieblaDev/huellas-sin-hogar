import { idParamSchema } from './request.schema.js';
import { z } from 'zod';

export const asignarCanilSchema = z.object({
  canilId: z.number().int().positive('Debe seleccionar un canil válido'),
  animalId: z.number().int().positive('Debe seleccionar un animal válido').nullable().optional(),
  motivo: z.string().trim().nullish(),
  fechaFinEstimada: z.union([z.string().date(), z.string().datetime({ offset: true })]).nullish(),
  observaciones: z.string().max(4000).nullish(),
  confirmarLiberacionMultiple: z.boolean().optional(),
  origenEsperadoId: z.number().int().positive().nullish(),
  estado: z.enum(['LIBRE', 'OCUPADO', 'CUARENTENA', 'MANTENIMIENTO']).default('OCUPADO')
});

export const trasladoExternoSchema = z.object({
  animalId: z.number().int().positive('Debe seleccionar un animal válido para el traslado'),
  tipo: z.enum(['PROTECTORA_ALIADA', 'HOGAR_TEMPORAL']),
  motivo: z.string().min(3, 'El motivo del traslado es obligatorio'),
  destinoNombre: z.string().min(2, 'El nombre del destino es obligatorio'),
  destinoContacto: z.string().optional().nullable(),
  destinoEmail: z.string().trim().max(254).email('Ingresa un correo electrónico válido.').nullish(),
  destinoDireccion: z.string().optional().nullable()
}).refine(datos => datos.tipo !== 'PROTECTORA_ALIADA' || Boolean(datos.destinoEmail), {
  path: ['destinoEmail'], message: 'Ingresa el correo de la protectora aliada.'
});

export const gestionAprobacionSchema = z.object({
  aprobar: z.boolean(),
  comentario: z.string().optional().nullable()
});

export const crearCanilSchema = z.object({
  codigo: z.string().min(1, 'El código del canil es obligatorio'),
  nombre: z.string().min(1, 'El nombre del canil es obligatorio'),
  sector: z.string().trim().min(1).max(60).default('General'),
  tipo: z.enum(['Perro','Gato','Mixto']).default('Mixto'),
  notas: z.string().max(500).nullish(),
  capacidad: z.number().int().min(1).max(20).optional().default(1),
  estado: z.enum(['LIBRE','MANTENIMIENTO']).default('LIBRE')
});

export const actualizarCanilSchema = crearCanilSchema.pick({ sector: true, tipo: true, capacidad: true, notas: true }).extend({ sector: z.string().trim().min(1).max(60) }).partial().strict();
export const finalizarCuarentenaSchema = z.object({ animalId: z.number().int().positive().optional(), observaciones: z.string().max(4000).nullish() });
export const historialCanilSchema = z.object({ limit: z.coerce.number().int().min(1).max(100).default(20), cursor: z.coerce.number().int().positive().optional() });

export const eliminarCanilSchema = idParamSchema;

export const canilIdParamSchema = idParamSchema;

export const actualizarSectorCanilSchema = z.object({
  sector: z.string().trim().min(1, 'El sector es obligatorio').max(60, 'El sector no puede superar los 60 caracteres')
});

export const listarTrasladosSchema = z.object({ estado: z.enum(['PENDIENTE_APROBACION', 'APROBADO', 'RECHAZADO', 'COMPLETADO']).optional() });
