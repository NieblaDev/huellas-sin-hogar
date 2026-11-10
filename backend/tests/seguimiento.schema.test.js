import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canalContactoSchema,
  programarSeguimientoSchema,
  registrarSeguimientoSchema,
  reprogramarIntentoSchema,
  configurarLimiteIntentosSchema,
  seguimientoIdSchema,
  listarSeguimientosSchema
} from '../src/schemas/seguimiento.schema.js';
import {
  registrarDevolucionSchema,
  devolucionIdSchema,
  listarDevolucionesSchema
} from '../src/schemas/devolucion.schema.js';

test('canalContacto: normaliza nombres comunes y valida canales permitidos', () => {
  assert.equal(canalContactoSchema.parse('llamada'), 'LLAMADA_TELEFONICA');
  assert.equal(canalContactoSchema.parse('Llamada Telefónica'), 'LLAMADA_TELEFONICA');
  assert.equal(canalContactoSchema.parse('visita presencial'), 'VISITA_DOMICILIARIA');
  assert.equal(canalContactoSchema.parse('VISITA_DOMICILIARIA'), 'VISITA_DOMICILIARIA');
  assert.equal(canalContactoSchema.parse('email'), 'CORREO_ELECTRONICO');
  assert.equal(canalContactoSchema.parse('WhatsApp'), 'WHATSAPP');
  assert.equal(canalContactoSchema.parse('videollamada'), 'OTRO');
  assert.equal(canalContactoSchema.parse('otro'), 'OTRO');

  assert.equal(canalContactoSchema.safeParse('telepatia').success, false);
  assert.equal(canalContactoSchema.safeParse('').success, false);
});

test('registrarSeguimiento: valida campos obligatorios y formato de fecha', () => {
  const payloadValido = {
    fecha: '2026-11-10T14:00:00Z',
    canalContacto: 'WHATSAPP',
    estadoAnimal: 'Adaptándose excelente, comiendo con normalidad y con ánimo activo.',
    resultado: 'Favorable - Adoptante muy comprometido',
    observaciones: 'Se enviaron fotos y videos del animal.'
  };

  const parsed = registrarSeguimientoSchema.parse(payloadValido);
  assert.equal(parsed.canalContacto, 'WHATSAPP');
  assert.equal(parsed.resultado, 'Favorable - Adoptante muy comprometido');

  // Faltan campos obligatorios
  assert.equal(registrarSeguimientoSchema.safeParse({ ...payloadValido, estadoAnimal: 'ok' }).success, false);
  assert.equal(registrarSeguimientoSchema.safeParse({ ...payloadValido, resultado: 'a' }).success, false);
  assert.equal(registrarSeguimientoSchema.safeParse({ ...payloadValido, fecha: 'fecha-invalida' }).success, false);
});

test('reprogramarIntento: valida fecha futura y coherencia con la fecha del intento', () => {
  const payloadValido = {
    fechaIntento: '2026-11-10T10:00:00Z',
    canalContacto: 'LLAMADA',
    resultado: 'NO_RESPONDE',
    observaciones: 'Llamada no atendida, se reprograma para pasado mañana.',
    fechaReprogramada: '2026-11-12T10:00:00Z'
  };

  const parsed = reprogramarIntentoSchema.parse(payloadValido);
  assert.equal(parsed.canalContacto, 'LLAMADA_TELEFONICA');
  assert.equal(parsed.resultado, 'NO_RESPONDE');

  // Fecha reprogramada anterior o igual a la del intento debe fallar
  const fechaInvalida = {
    ...payloadValido,
    fechaReprogramada: '2026-11-09T10:00:00Z'
  };
  const res = reprogramarIntentoSchema.safeParse(fechaInvalida);
  assert.equal(res.success, false);
  assert.ok(res.error.issues.some(i => i.path.includes('fechaReprogramada')));
});

test('configurarLimiteIntentos: restringe el límite entre 1 y 20 intentos', () => {
  assert.equal(configurarLimiteIntentosSchema.parse({ limite: 3 }).limite, 3);
  assert.equal(configurarLimiteIntentosSchema.parse({ limite: '5' }).limite, 5);

  assert.equal(configurarLimiteIntentosSchema.safeParse({ limite: 0 }).success, false);
  assert.equal(configurarLimiteIntentosSchema.safeParse({ limite: -1 }).success, false);
  assert.equal(configurarLimiteIntentosSchema.safeParse({ limite: 21 }).success, false);
  assert.equal(configurarLimiteIntentosSchema.safeParse({ limite: 'abc' }).success, false);
});

test('programarSeguimiento: valida parámetros de programación', () => {
  const valido = {
    adopcionId: 1,
    fechaProgramada: '2026-11-25T15:00:00Z',
    tipoSeguimiento: 'EXTRAORDINARIO',
    diasProgramados: 45,
    observaciones: 'Seguimiento por tratamiento médico menor.'
  };

  const parsed = programarSeguimientoSchema.parse(valido);
  assert.equal(parsed.adopcionId, 1);
  assert.equal(parsed.tipoSeguimiento, 'EXTRAORDINARIO');

  assert.equal(programarSeguimientoSchema.safeParse({ ...valido, adopcionId: 0 }).success, false);
  assert.equal(programarSeguimientoSchema.safeParse({ ...valido, fechaProgramada: 'invalida' }).success, false);
});

test('registrarDevolucion: valida datos de reingreso, motivo y observaciones del postulante', () => {
  const devolucionValida = {
    adopcionId: 1,
    fecha: '2026-11-10T16:00:00Z',
    motivo: 'Incompatibilidad de horarios laborales para el cuidado.',
    estadoAnimal: 'Buen estado nutricional, pelaje limpio, algo temeroso.',
    observacionesPostulante: 'Adoptante reconoce falta de tiempo. No apto para adopciones de alta demanda.',
    canilId: 2
  };

  const parsed = registrarDevolucionSchema.parse(devolucionValida);
  assert.equal(parsed.adopcionId, 1);
  assert.equal(parsed.canilId, 2);
  assert.ok(parsed.motivo.length >= 5);

  // Motivo muy corto
  assert.equal(registrarDevolucionSchema.safeParse({ ...devolucionValida, motivo: 'no' }).success, false);
  // Estado de animal muy corto
  assert.equal(registrarDevolucionSchema.safeParse({ ...devolucionValida, estadoAnimal: 'ok' }).success, false);
  // ID inválido
  assert.equal(registrarDevolucionSchema.safeParse({ ...devolucionValida, adopcionId: -5 }).success, false);
});

test('seguridad: los esquemas son estrictos y rechazan inyección de campos no permitidos', () => {
  const seguimiento = {
    fecha: '2026-11-10T14:00:00Z',
    canalContacto: 'WHATSAPP',
    estadoAnimal: 'Bien',
    resultado: 'Favorable'
  };

  // No permite falsificar responsable ni campos de sistema
  for (const campo of ['responsableId', 'id', 'estado', 'intentosFallidos', 'alertaSinContacto']) {
    assert.equal(registrarSeguimientoSchema.safeParse({ ...seguimiento, [campo]: 1 }).success, false);
  }

  const devolucion = {
    adopcionId: 1,
    fecha: '2026-11-10T16:00:00Z',
    motivo: 'Motivo válido de devolución',
    estadoAnimal: 'Estado válido del animal'
  };

  for (const campo of ['responsableId', 'id', 'devolucion', 'creadoEn']) {
    assert.equal(registrarDevolucionSchema.safeParse({ ...devolucion, [campo]: 1 }).success, false);
  }
});

test('identificadores y filtros de listado validan rangos y paginación', () => {
  assert.equal(seguimientoIdSchema.safeParse({ id: '1' }).success, true);
  assert.equal(seguimientoIdSchema.safeParse({ id: '0' }).success, false);
  assert.equal(devolucionIdSchema.safeParse({ id: '1' }).success, true);
  assert.equal(devolucionIdSchema.safeParse({ id: '-1' }).success, false);

  assert.deepEqual(listarSeguimientosSchema.parse({}), { pagina: 1, limite: 20 });
  assert.equal(listarSeguimientosSchema.safeParse({ limite: 51 }).success, false);
  assert.equal(listarSeguimientosSchema.safeParse({ estado: 'DESCONOCIDO' }).success, false);

  assert.deepEqual(listarDevolucionesSchema.parse({}), { pagina: 1, limite: 20 });
  assert.equal(listarDevolucionesSchema.safeParse({ limite: 0 }).success, false);
});
