import { z } from 'zod';

export const createAnimalSchema = z.object({
  nombre: z
    .string({ required_error: 'El nombre o identificador inicial es obligatorio' })
    .trim()
    .min(1, 'El nombre debe tener al menos 1 carácter'),

  // Regla 1: Validación estricta — solo especie canina ('perro') o felina ('gato')
  especie: z
    .preprocess((val) => (typeof val === 'string' ? val.trim() : ''), z.string())
    .refine((val) => ['perro', 'gato'].includes(val.toLowerCase()), {
      message: "Validación estricta: Solo se permite el ingreso si la especie es canina ('perro') o felina ('gato')"
    })
    .transform((val) => (val.toLowerCase() === 'perro' ? 'Perro' : 'Gato')),

  // Regla 1: Validación estricta — sexo definido obligatoriamente ('macho' o 'hembra')
  sexo: z
    .preprocess((val) => (typeof val === 'string' ? val.trim() : ''), z.string())
    .refine((val) => ['macho', 'hembra'].includes(val.toLowerCase()), {
      message: "Validación estricta: El sexo del animal debe estar definido ('macho' o 'hembra')"
    })
    .transform((val) => (val.toLowerCase() === 'macho' ? 'Macho' : 'Hembra')),

  // Causal de ingreso (Rescate, Abandono o Decomiso)
  tipoIngreso: z
    .string()
    .optional()
    .nullable()
    .transform((val) => {
      if (!val || val.trim() === '') return 'Rescate';
      const lower = val.trim().toLowerCase();
      if (lower === 'rescate') return 'Rescate';
      if (lower === 'abandono') return 'Abandono';
      if (lower === 'decomiso') return 'Decomiso';
      return val.trim();
    })
    .refine((val) => ['Rescate', 'Abandono', 'Decomiso'].includes(val), {
      message: "El tipo de ingreso debe ser 'Rescate', 'Abandono' o 'Decomiso'"
    }),

  // Regla 2: Flexibilidad de datos — antecedentes desconocidos opcionales/anulables sin bloquear el guardado
  edad: z
    .string()
    .optional()
    .nullable()
    .transform((val) => (val && val.trim() !== '' ? val.trim() : 'Desconocida')),

  raza: z
    .string()
    .optional()
    .nullable()
    .transform((val) => (val && val.trim() !== '' ? val.trim() : 'Desconocida')),

  peso: z.preprocess(
    (val) => {
      if (val === '' || val === null || val === undefined) return 0;
      const parsed = Number(val);
      return Number.isNaN(parsed) ? 0 : parsed;
    },
    z.number().nonnegative('El peso no puede ser negativo').default(0)
  ),

  chip: z
    .string()
    .optional()
    .nullable()
    .transform((val) => (val && val.trim() !== '' ? val.trim() : null)),

  estadoSalud: z
    .preprocess(
      (val) => (!val || val === '' ? 'NORMAL' : String(val).toUpperCase()),
      z.enum(['NORMAL', 'CONDICION_ESPECIAL', 'CRITICO'])
    )
    .default('NORMAL'),

  nota: z
    .string()
    .optional()
    .nullable()
    .transform((val) => (val && val.trim() !== '' ? val.trim() : null)),

  historialMedico: z
    .string()
    .optional()
    .nullable()
    .transform((val) => (val && val.trim() !== '' ? val.trim() : null)),

  fotoUrl: z
    .string()
    .optional()
    .nullable()
    .transform((val) => (val && val.trim() !== '' ? val : null)),

  esterilizacion: z
    .string()
    .optional()
    .nullable()
    .transform((val) => (val && val.trim() !== '' ? val.trim() : 'Desconocido')),

  comportamiento: z
    .string()
    .optional()
    .nullable()
    .transform((val) => (val && val.trim() !== '' ? val.trim() : 'Por evaluar')),

  canilId: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? null : Number(val)),
    z.number().int().positive().nullable().optional()
  )
});