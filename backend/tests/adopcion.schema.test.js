import test from 'node:test';
import assert from 'node:assert/strict';
import { crearSolicitudSchema, antecedentesQuerySchema, solicitudIdSchema, listarSolicitudesSchema } from '../src/schemas/adopcion.schema.js';
import { normalizarIdentificacion, esRutValido } from '../src/utils/postulanteIdentificacion.js';

const solicitud = () => ({
  postulante: { tipoIdentificacion: 'RUT', identificacion: '12.345.678-5', nombre: 'Ana Pérez', email: 'ANA@example.com', telefono: '+56 9 1234 5678', direccion: 'Calle Uno 123' },
  animalId: 1, motivacion: 'Hogar con espacio y tiempo para cuidar al animal.'
});

test('normaliza RUT y valida su dígito verificador', () => {
  assert.equal(normalizarIdentificacion(' 12.345.678-5 '), '123456785');
  assert.equal(esRutValido('123456785'), true);
  assert.equal(esRutValido('123456789'), false);
  assert.equal(esRutValido('000000000'), false);
  assert.equal(antecedentesQuerySchema.parse({ identificacion: '12 345 678-5' }).identificacion, '123456785');
});

test('normaliza documentos alternativos sin mezclar su tipo con el RUT', () => {
  assert.deepEqual(antecedentesQuerySchema.parse({ tipoIdentificacion: 'OTRO', identificacion: ' ab 123 ' }), { tipoIdentificacion: 'OTRO', identificacion: 'AB123' });
  assert.equal(antecedentesQuerySchema.safeParse({ tipoIdentificacion: 'OTRO', identificacion: '***' }).success, false);
});

test('valida y normaliza datos del formulario', () => {
  const parsed = crearSolicitudSchema.parse(solicitud());
  assert.equal(parsed.postulante.email, 'ana@example.com');
  assert.equal(parsed.postulante.identificacion, '123456785');
  for (const value of ['', '   ', 'a']) {
    assert.equal(crearSolicitudSchema.safeParse({ ...solicitud(), motivacion: value }).success, false);
  }
});

test('rechaza manipulación de responsable, estado y campos no previstos', () => {
  for (const campo of ['registradoPorId', 'estado', 'creadoEn', 'id']) {
    assert.equal(crearSolicitudSchema.safeParse({ ...solicitud(), [campo]: 1 }).success, false);
  }
  assert.equal(crearSolicitudSchema.safeParse({ ...solicitud(), animalId: '1' }).success, false);
  assert.equal(crearSolicitudSchema.safeParse({ ...solicitud(), postulante: { ...solicitud().postulante, id: 1 } }).success, false);
});

test('limita parámetros de consulta y valida identificadores', () => {
  assert.equal(solicitudIdSchema.safeParse({ id: '0' }).success, false);
  assert.equal(solicitudIdSchema.safeParse({ id: '2147483648' }).success, false);
  assert.equal(listarSolicitudesSchema.safeParse({ limite: '51' }).success, false);
  assert.equal(listarSolicitudesSchema.safeParse({ estado: 'DESCONOCIDO' }).success, false);
  assert.deepEqual(listarSolicitudesSchema.parse({}), { pagina: 1, limite: 20 });
});
