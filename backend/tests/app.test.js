import test from 'node:test';
import assert from 'node:assert/strict';
import { validate } from '../src/middlewares/validate.middleware.js';
import { errorHandler } from '../src/middlewares/error.middleware.js';
import { idParamSchema } from '../src/schemas/request.schema.js';

function respuesta() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.data = data; return this; }
  };
}

test('la validación transforma el identificador de ruta en número', () => {
  const req = { params: { id: '47' } };
  validate(idParamSchema, 'params')(req, respuesta(), () => assert.equal(req.params.id, 47));
});

test('la validación corta el flujo y devuelve detalles cuando el identificador es inválido', () => {
  const res = respuesta();
  validate(idParamSchema, 'params')({ params: { id: '2e4' } }, res, () => assert.fail('El flujo debía detenerse'));
  assert.equal(res.statusCode, 400);
  assert.equal(res.data.detalles.length, 1);
});

test('el middleware traduce códigos de Prisma y conserva las alertas de dominio', () => {
  for (const [code, status] of [['P2002', 409], ['P2025', 404], ['P2003', 400]]) {
    const res = respuesta();
    errorHandler({ code }, {}, res, () => assert.fail('El error debía recibir una respuesta JSON'));
    assert.equal(res.statusCode, status);
    assert.equal(typeof res.data.error, 'string');
  }
  const res = respuesta();
  const alertas = [{ tipo: 'ANTECEDENTE' }];
  errorHandler({ status: 409, message: 'Conflicto', alertas }, {}, res, () => assert.fail());
  assert.deepEqual(res.data, { error: 'Conflicto', alertas });
});
