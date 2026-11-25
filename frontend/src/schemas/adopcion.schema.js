import { z } from 'zod';
import { fechaHora, idSeleccion, opcional, texto } from './campos.js';
import { esRutValido, normalizarIdentificacion } from '../utils/postulanteIdentificacion.js';

const postulante = z.object({
  tipoIdentificacion: z.enum(['RUT', 'OTRO']),
  identificacion: texto(3, 60),
  nombre: texto(2, 100),
  email: z.string().trim().email('Ingresa un correo electrónico válido.').max(120),
  telefono: texto(7, 30).regex(/^\+?[\d\s()-]+$/, 'Usa números, espacios, paréntesis, guiones y un + opcional.'),
  direccion: texto(5, 200)
}).superRefine((datos, ctx) => {
  const valor = normalizarIdentificacion(datos.identificacion, datos.tipoIdentificacion);
  const valido = datos.tipoIdentificacion === 'RUT' ? esRutValido(valor) : /^[A-Z0-9-]{3,20}$/.test(valor);
  if (!valido) ctx.addIssue({ code: 'custom', path: ['identificacion'], message: 'Revisa el RUT o número de documento.' });
});

export const solicitudSchema = z.object({
  postulante, animalId: idSeleccion, motivacion: texto(10, 4000)
});

export const etapaSchema = z.object({
  accionEtapa: z.enum(['EVALUAR', 'AGENDAR_VISITA', 'REGISTRAR_VISITA', 'OMITIR_VISITA', 'APROBAR', 'RECHAZAR', 'CANCELAR', 'ENTREGAR']),
  fechaEtapa: fechaHora,
  resultadoEvalEtapa: z.enum(['', 'CUMPLE', 'NO_CUMPLE', 'PENDIENTE']),
  motivoOmisionEtapa: opcional(2000),
  observacionesEtapa: texto(3, 4000)
}).superRefine((datos, ctx) => {
  if (datos.accionEtapa === 'EVALUAR' && !datos.resultadoEvalEtapa) {
    ctx.addIssue({ code: 'custom', path: ['resultadoEvalEtapa'], message: 'Selecciona el resultado de la evaluación.' });
  }
  if (datos.accionEtapa === 'OMITIR_VISITA' && !texto(3).safeParse(datos.motivoOmisionEtapa).success) {
    ctx.addIssue({ code: 'custom', path: ['motivoOmisionEtapa'], message: 'Explica en al menos 3 caracteres por qué se omite la visita.' });
  }
});

const seguimientoBase = z.object({
  fecha: fechaHora,
  canal: z.enum(['VISITA_PRESENCIAL', 'VIDEOLLAMADA', 'LLAMADA_TELEFONICA', 'WHATSAPP', 'CORREO', 'OTRO'], {
    errorMap: () => ({ message: 'Selecciona un canal de contacto.' })
  })
});

export const seguimientoSchema = z.discriminatedUnion('accion', [
  seguimientoBase.extend({ accion: z.literal('REGISTRAR'), estadoAnimal: texto(3, 4000), resultado: texto(3, 100), observaciones: opcional(4000) }),
  seguimientoBase.extend({ accion: z.literal('REPROGRAMAR'), fechaReprogramada: fechaHora, resultado: opcional(100), observaciones: texto(3, 4000) })
]).refine(datos => datos.accion !== 'REPROGRAMAR' || datos.fechaReprogramada > datos.fecha, {
  message: 'Selecciona una fecha posterior al intento de contacto.', path: ['fechaReprogramada']
});

export const devolucionSchema = z.object({
  fecha: fechaHora, motivo: texto(5, 4000), estadoAnimal: texto(3, 4000), observacionesPostulante: opcional(4000)
});
