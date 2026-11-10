import { z } from 'zod';

export const ESTADOS_SEGUIMIENTO = ['PENDIENTE', 'REPROGRAMADO', 'COMPLETADO', 'SIN_CONTACTO'];
export const TIPOS_SEGUIMIENTO = ['SEGUIMIENTO_15_DIAS', 'SEGUIMIENTO_30_DIAS', 'EXTRAORDINARIO'];

export const CANALES_CONTACTO = [
  'LLAMADA_TELEFONICA',
  'WHATSAPP',
  'CORREO_ELECTRONICO',
  'VISITA_DOMICILIARIA',
  'OTRO'
];

const CANAL_MAP = {
  'LLAMADA_TELEFONICA': 'LLAMADA_TELEFONICA',
  'LLAMADA': 'LLAMADA_TELEFONICA',
  'TELEFONO': 'LLAMADA_TELEFONICA',
  'WHATSAPP': 'WHATSAPP',
  'CORREO_ELECTRONICO': 'CORREO_ELECTRONICO',
  'CORREO': 'CORREO_ELECTRONICO',
  'EMAIL': 'CORREO_ELECTRONICO',
  'VISITA_DOMICILIARIA': 'VISITA_DOMICILIARIA',
  'VISITA_PRESENCIAL': 'VISITA_DOMICILIARIA',
  'VISITA': 'VISITA_DOMICILIARIA',
  'VIDEOLLAMADA': 'OTRO',
  'OTRO': 'OTRO'
};

const normalizarClaveCanal = val =>
  val.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase().replace(/[\s-]+/g, '_');

export const canalContactoSchema = z.string().trim().refine(val => {
  const normalizado = normalizarClaveCanal(val);
  return normalizado in CANAL_MAP;
}, {
  message: 'Canal de contacto no válido. Opciones: llamada telefónica, WhatsApp, correo electrónico, visita domiciliaria u otro.'
}).transform(val => CANAL_MAP[normalizarClaveCanal(val)]);

// Programar seguimiento (15 días, 30 días o extraordinario)
export const programarSeguimientoSchema = z.object({
  adopcionId: z.number().int().positive().max(2147483647),
  fechaProgramada: z.string().datetime({ offset: true, message: 'Indica una fecha programada válida en formato ISO.' }),
  tipoSeguimiento: z.enum(TIPOS_SEGUIMIENTO).default('EXTRAORDINARIO'),
  diasProgramados: z.number().int().min(1).max(365).optional(),
  observaciones: z.string().trim().max(4000, 'Las observaciones admiten hasta 4000 caracteres.').optional()
}).strict();

// Registrar contacto realizado / completar seguimiento
export const registrarSeguimientoSchema = z.object({
  fecha: z.string().datetime({ offset: true, message: 'Indica una fecha y hora válidas.' }),
  canalContacto: canalContactoSchema,
  estadoAnimal: z.string().trim().min(3, 'Describe el estado del animal con al menos 3 caracteres.').max(4000, 'El estado del animal admite hasta 4000 caracteres.'),
  resultado: z.string().trim().min(3, 'Indica el resultado del seguimiento (mínimo 3 caracteres).').max(100, 'El resultado admite hasta 100 caracteres.'),
  observaciones: z.string().trim().max(4000, 'Las observaciones admiten hasta 4000 caracteres.').optional(),
  actualizadoEn: z.string().datetime({ message: 'Indica la fecha de actualización para control de concurrencia.' }).optional()
}).strict();

// Registrar intento fallido y reprogramar fecha
export const reprogramarIntentoSchema = z.object({
  fechaIntento: z.string().datetime({ offset: true, message: 'Indica la fecha y hora del intento.' }).default(() => new Date().toISOString()),
  canalContacto: canalContactoSchema,
  resultado: z.string().trim().min(3, 'Indica el resultado del intento (ej. NO_RESPONDE, BUZON_DE_VOZ).').max(100).default('NO_RESPONDE'),
  observaciones: z.string().trim().min(3, 'Indica observaciones del intento fallido (mínimo 3 caracteres).').max(4000),
  fechaReprogramada: z.string().datetime({ offset: true, message: 'Indica una fecha futura para el próximo intento.' }),
  actualizadoEn: z.string().datetime({ message: 'Indica la fecha de actualización para control de concurrencia.' }).optional()
}).strict().superRefine((data, ctx) => {
  const intento = new Date(data.fechaIntento);
  const reprogramada = new Date(data.fechaReprogramada);
  if (!isNaN(intento.getTime()) && !isNaN(reprogramada.getTime()) && reprogramada <= intento) {
    ctx.addIssue({
      code: 'custom',
      path: ['fechaReprogramada'],
      message: 'La fecha reprogramada debe ser posterior a la fecha del intento fallido.'
    });
  }
});

// Configurar límite configurable de intentos fallidos antes de alerta sin contacto
export const configurarLimiteIntentosSchema = z.object({
  limite: z.coerce.number().int().min(1, 'El límite debe ser de al menos 1 intento.').max(20, 'El límite no puede exceder 20 intentos.')
}).strict();

// Identificador de seguimiento
export const seguimientoIdSchema = z.object({
  id: z.coerce.number().int().positive().max(2147483647)
}).strict();

// Filtros y paginación para lista de seguimientos
export const listarSeguimientosSchema = z.object({
  adopcionId: z.coerce.number().int().positive().max(2147483647).optional(),
  estado: z.enum(ESTADOS_SEGUIMIENTO).optional(),
  alertaSinContacto: z.preprocess(val => (val === 'true' ? true : val === 'false' ? false : val), z.boolean().optional()),
  pagina: z.coerce.number().int().min(1).max(1000000).default(1),
  limite: z.coerce.number().int().min(1).max(50).default(20)
}).strict();
