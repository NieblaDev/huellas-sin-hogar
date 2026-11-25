import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readStoredSession } from '../src/utils/session.js';
const now = Date.now();
const user = { id: 1, nombre: 'Staff de prueba', rol: 'DIRECCION' };
const token = payload => `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;
const storage = (savedUser, savedToken) => {
  const values = new Map([['user', savedUser], ['token', savedToken], ['unrelated', 'conservar']]);
  return { getItem: key => values.get(key) ?? null, removeItem: key => values.delete(key) };
};

test('restaura una sesión con formato válido y no expirada', () => {
  const jwt = token({ id: 1, exp: Math.floor(now / 1000) + 3600 });
  assert.deepEqual(readStoredSession(storage(JSON.stringify(user), jwt), now), { user, token: jwt });
});

test('limpia JSON inválido, identidades incompatibles y tokens vencidos sin lanzar errores', () => {
  const validToken = token({ id: 1, exp: Math.floor(now / 1000) + 3600 });
  for (const [saved, jwt] of [
    ['undefined', validToken], ['null', validToken], ['{}', validToken],
    [JSON.stringify(user), 'token-invalido'], [JSON.stringify(user), 'a.invalid.c'],
    [JSON.stringify(user), token({ id: 1, exp: Math.floor(now / 1000) - 1 })],
    [JSON.stringify(user), token({ id: 2, exp: Math.floor(now / 1000) + 3600 })],
    [JSON.stringify(user), token({ id: 1 })], [JSON.stringify(user), null], [null, validToken]
  ]) {
    const local = storage(saved, jwt);
    assert.equal(readStoredSession(local, now), null);
    assert.equal(local.getItem('user'), null);
    assert.equal(local.getItem('token'), null);
    assert.equal(local.getItem('unrelated'), 'conservar');
  }
});

test('si el almacenamiento está bloqueado, mantiene accesible el inicio de sesión', () => {
  assert.equal(readStoredSession({ getItem() { throw new Error('SecurityError'); }, removeItem() { throw new Error('SecurityError'); } }), null);
});
