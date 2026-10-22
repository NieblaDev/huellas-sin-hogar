import { z } from 'zod';
import { esRutValido, normalizarIdentificacion } from '../utils/postulanteIdentificacion.js';

export const ESTADOS_ACTIVOS = ['RECIBIDA', 'EN_EVALUACION', 'VISITA_AGENDADA', 'VISITA_REALIZADA', 'APROBADA'];
export const ESTADOS_SOLICITUD = [...ESTADOS_ACTIVOS, 'RECHAZADA', 'ENTREGADA', 'CANCELADA'];

const camposIdentificacion = {
  tipoIdentificacion: z.enum(['RUT', 'OTRO']).default('RUT'),
  identificacion: z.string().trim().min(3).max(60)
};

const validarIdentificacion = (data, ctx) => {
  const identificacion = normalizarIdentificacion(data.identificacion, data.tipoIdentificacion);
  if (data.tipoIdentificacion === 'RUT' ? !esRutValido(identificacion) : !/^[A-Z0-9-]{3,20}$/.test(identificacion)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['identificacion'], message: data.tipoIdentificacion === 'RUT' ? 'RUT inválido. Ejemplo: 12.345.678-5. Revisa que el número y su dígito verificador sean correctos.' : 'Usa entre 3 y 20 letras, números o guiones. Ejemplo: AB123456.' });
  }
};
const normalizar = data => ({ ...data, identificacion: normalizarIdentificacion(data.identificacion, data.tipoIdentificacion) });

export const antecedentesQuerySchema = z.object(camposIdentificacion).strict().superRefine(validarIdentificacion).transform(normalizar);

export const postulanteSchema = z.object({
  ...camposIdentificacion,
  nombre: z.string().trim().min(2, 'Escribe al menos 2 caracteres para el nombre.').max(100, 'El nombre admite hasta 100 caracteres.'),
  email: z.string().trim().email('Escribe un correo como ana@ejemplo.cl.').max(120, 'El correo admite hasta 120 caracteres.').transform(value => value.toLowerCase()),
  telefono: z.string().trim().min(7, 'El teléfono debe tener al menos 7 caracteres. Ejemplo: +56 9 1234 5678.').max(30, 'El teléfono admite hasta 30 caracteres.').regex(/^\+?[\d\s()-]+$/, 'Usa números, espacios, paréntesis o guiones y un + opcional al inicio. Ejemplo: +56 9 1234 5678.'),
  direccion: z.string().trim().min(5, 'Escribe una dirección de al menos 5 caracteres. Ejemplo: Los Aromos 123, Santiago.').max(200, 'La dirección admite hasta 200 caracteres.')
}).strict().superRefine(validarIdentificacion).transform(normalizar);

export const crearSolicitudSchema = z.object({
  postulante: postulanteSchema,
  animalId: z.number().int().positive().max(2147483647),
  motivacion: z.string().trim().min(10, 'Describe la motivación y el hogar con al menos 10 caracteres.').max(4000, 'La motivación admite hasta 4000 caracteres.')
}).strict();

export const solicitudIdSchema = z.object({ id: z.coerce.number().int().positive().max(2147483647) }).strict();

export const listarSolicitudesSchema = z.object({
  estado: z.enum(ESTADOS_SOLICITUD).optional(),
  search: z.string().trim().max(120).optional(),
  pagina: z.coerce.number().int().min(1).max(1000000).default(1),
  limite: z.coerce.number().int().min(1).max(50).default(20)
}).strict();

export const editarSolicitudSchema = crearSolicitudSchema.extend({ actualizadoEn: z.string().datetime() });
export const eliminarSolicitudSchema = z.object({ actualizadoEn: z.string().datetime() }).strict();
