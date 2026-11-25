import test from 'node:test';
import assert from 'node:assert/strict';
import { diasEntre } from '../src/utils/fechas.js';
test('días de estadía por calendario UTC', () => {
  assert.equal(diasEntre(null),null);
  assert.equal(diasEntre('2026-11-25T00:01Z','2026-11-25T23:59Z'),0);
  assert.equal(diasEntre('2026-11-25','2026-11-24'),0);
  assert.equal(diasEntre('2026-11-24T23:59Z','2026-11-25T00:01Z'),1);
});
