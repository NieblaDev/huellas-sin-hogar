import { z } from 'zod';

export const createAnimalSchema = z.object({
  nombre: z
    .string({ required_error: 'El nombre o identificador inicial es obligatorio' })
    .trim()
    .min(1, 'El nombre debe tener al menos 1 carácter'),

  // Especie canina ('perro') o felina ('gato') obligatoria
  especie: z
    .preprocess((val) => (typeof val === 'string' ? val.trim() : ''), z.string())
    .refine((val) => ['perro', 'gato'].includes(val.toLowerCase()), {
      message: 'Debes especificar la especie (canina o felina) y el sexo del animal para completar el ingreso.'
    })
    .transform((val) => (val.toLowerCase() === 'perro' ? 'Perro' : 'Gato')),

  // Sexo definido obligatoriamente ('macho' o 'hembra')
  sexo: z
    .preprocess((val) => (typeof val === 'string' ? val.trim() : ''), z.string())
    .refine((val) => ['macho', 'hembra'].includes(val.toLowerCase()), {
      message: 'Debes especificar la especie (canina o felina) y el sexo del animal para completar el ingreso.'
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

export const updateAnimalSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, 'El nombre debe tener al menos 1 carácter')
    .optional(),

  especie: z
    .preprocess((val) => (typeof val === 'string' && val.trim() !== '' ? val.trim() : undefined), z.string().optional())
    .refine((val) => val === undefined || ['perro', 'gato'].includes(val.toLowerCase()), {
      message: 'Debes especificar la especie (canina o felina) y el sexo del animal.'
    })
    .transform((val) => (val === undefined ? undefined : val.toLowerCase() === 'perro' ? 'Perro' : 'Gato')),

  sexo: z
    .preprocess((val) => (typeof val === 'string' && val.trim() !== '' ? val.trim() : undefined), z.string().optional())
    .refine((val) => val === undefined || ['macho', 'hembra'].includes(val.toLowerCase()), {
      message: 'Debes especificar la especie (canina o felina) y el sexo del animal.'
    })
    .transform((val) => (val === undefined ? undefined : val.toLowerCase() === 'macho' ? 'Macho' : 'Hembra')),

  tipoIngreso: z
    .string()
    .optional()
    .nullable()
    .transform((val) => {
      if (val === undefined) return undefined;
      if (val === null || val.trim() === '') return 'Rescate';
      const lower = val.trim().toLowerCase();
      if (lower === 'rescate') return 'Rescate';
      if (lower === 'abandono') return 'Abandono';
      if (lower === 'decomiso') return 'Decomiso';
      return val.trim();
    })
    .refine((val) => val === undefined || ['Rescate', 'Abandono', 'Decomiso'].includes(val), {
      message: "El tipo de ingreso debe ser 'Rescate', 'Abandono' o 'Decomiso'"
    }),

  edad: z
    .string()
    .optional()
    .nullable()
    .transform((val) => (val === undefined ? undefined : val && val.trim() !== '' ? val.trim() : 'Desconocida')),

  raza: z
    .string()
    .optional()
    .nullable()
    .transform((val) => (val === undefined ? undefined : val && val.trim() !== '' ? val.trim() : 'Desconocida')),

  peso: z.preprocess(
    (val) => {
      if (val === undefined) return undefined;
      if (val === '' || val === null) return 0;
      const parsed = Number(val);
      return Number.isNaN(parsed) ? 0 : parsed;
    },
    z.number().nonnegative('El peso no puede ser negativo').optional()
  ),

  chip: z
    .string()
    .optional()
    .nullable()
    .transform((val) => (val === undefined ? undefined : val && val.trim() !== '' ? val.trim() : null)),

  estadoSalud: z
    .preprocess(
      (val) => (val === undefined || val === '' || val === null ? undefined : String(val).toUpperCase()),
      z.enum(['NORMAL', 'CONDICION_ESPECIAL', 'CRITICO']).optional()
    ),

  estadoAdopcion: z
    .preprocess(
      (val) => (val === undefined || val === '' || val === null ? undefined : String(val).toUpperCase()),
      z.enum(['EN_REFUGIO', 'ADOPTADO']).optional()
    ),

  nota: z
    .string()
    .optional()
    .nullable()
    .transform((val) => (val === undefined ? undefined : val && val.trim() !== '' ? val.trim() : null)),

  historialMedico: z
    .string()
    .optional()
    .nullable()
    .transform((val) => (val === undefined ? undefined : val && val.trim() !== '' ? val.trim() : null)),

  fotoUrl: z
    .string()
    .optional()
    .nullable()
    .transform((val) => (val === undefined ? undefined : val && val.trim() !== '' ? val : null)),

  eliminarFoto: z
    .preprocess((val) => val === true || val === 'true', z.boolean().optional()),

  esterilizacion: z
    .string()
    .optional()
    .nullable()
    .transform((val) => (val === undefined ? undefined : val && val.trim() !== '' ? val.trim() : 'Desconocido')),

  comportamiento: z
    .string()
    .optional()
    .nullable()
    .transform((val) => (val === undefined ? undefined : val && val.trim() !== '' ? val.trim() : 'Por evaluar')),

  canilId: z.preprocess(
    (val) => {
      if (val === undefined) return undefined;
      if (val === '' || val === null || val === 'null') return null;
      const parsed = Number(val);
      return Number.isNaN(parsed) ? null : parsed;
    },
    z.number().int().positive().nullable().optional()
  )
});