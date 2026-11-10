import { z } from 'zod';

export const registrarVacunaSchema = z.object({
  animalId: z.number().int().positive('ID de animal requerido'),
  nombreVacuna: z.string().min(2, 'Nombre de vacuna requerido'),
  dosis: z.string().min(1, 'Dosis requerida (ej: 1ra Dosis, Refuerzo Anual)'),
  lote: z.string().optional().nullable(),
  fechaAplicacion: z.string().datetime().optional(),
  fechaVencimiento: z.string().datetime({ message: 'Fecha de vencimiento requerida en formato ISO' }),
  observaciones: z.string().optional().nullable()
});

export const registrarAtencionSchema = z.object({
  animalId: z.number().int().positive(),
  motivo: z.string().min(3, 'El motivo clínico es obligatorio'),
  diagnostico: z.string().min(5, 'Diagnóstico clínico estructurado obligatorio'),
  temperatura: z.number().optional().nullable(),
  pesoActual: z.number().positive().optional().nullable(),
  tratamientos: z.array(z.object({
    medicamento: z.string().min(2),
    dosis: z.string().min(1),
    frecuenciaHoras: z.number().int().positive(),
    fechaFin: z.string().datetime(),
    indicacionesExtra: z.string().optional()
  })).optional(),
  procedimientos: z.array(z.object({
    tipo: z.enum([
      'ESTERILIZACION',
      'CIRUGIA_GENERAL',
      'DESPARASITACION_INTERNA',
      'DESPARASITACION_EXTERNA',
      'LIMPIEZA_DENTAL',
      'CURACION',
      'REVISION_GENERAL'
    ]),
    descripcion: z.string().min(3),
    resultado: z.string().optional()
  })).optional()
});

export const registrarCuarentenaSchema = z.object({
  animalId: z.number().int().positive(),
  motivo: z.string().min(5, 'Debe indicar el motivo médico del aislamiento'),
  canilAislamiento: z.string().optional().nullable(),
  fechaFinEstimada: z.string().datetime(),
  observaciones: z.string().optional().nullable()
});