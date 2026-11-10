import test from 'node:test';
import assert from 'node:assert/strict';
import {
  crearTurnoSchema,
  actualizarTurnoSchema,
  solicitarPermutaSchema,
  responderPermutaSchema,
  registrarBitacoraSchema
} from '../src/schemas/turno.schema.js';

test('crearTurnoSchema: valida campos obligatorios y cupo mínimo positivo', () => {
  const turnoValido = {
    diaSemana: 'Lunes',
    franja: 'Mañana',
    area: 'Atención Veterinaria',
    esCritica: true,
    cupoMaximo: 2,
    horaInicio: '08:00',
    horaFin: '13:00'
  };

  const parsed = crearTurnoSchema.parse(turnoValido);
  assert.equal(parsed.diaSemana, 'Lunes');
  assert.equal(parsed.esCritica, true);
  assert.equal(parsed.cupoMaximo, 2);

  // Cupo 0 debe ser rechazado
  const cupoCero = { ...turnoValido, cupoMaximo: 0 };
  assert.equal(crearTurnoSchema.safeParse(cupoCero).success, false);
});

test('solicitarPermutaSchema: valida turnoOrigen, destinatario y justificación', () => {
  const permutaValida = {
    turnoOrigenId: 10,
    destinatarioId: 5,
    turnoDestinoId: 12,
    motivo: 'Compromiso laboral imprevisto en la jornada matutina'
  };

  const parsed = solicitarPermutaSchema.parse(permutaValida);
  assert.equal(parsed.turnoOrigenId, 10);
  assert.equal(parsed.destinatarioId, 5);
  assert.equal(parsed.turnoDestinoId, 12);

  // Motivo demasiado corto debe ser rechazado
  const motivoCorto = { ...permutaValida, motivo: 'hi' };
  assert.equal(solicitarPermutaSchema.safeParse(motivoCorto).success, false);
});

test('responderPermutaSchema: solo admite APROBAR o RECHAZAR', () => {
  assert.equal(responderPermutaSchema.parse({ accion: 'APROBAR' }).accion, 'APROBAR');
  assert.equal(responderPermutaSchema.parse({ accion: 'RECHAZAR', observacion: 'No puedo ese día' }).accion, 'RECHAZAR');

  assert.equal(responderPermutaSchema.safeParse({ accion: 'OTRA_COSA' }).success, false);
});

test('registrarBitacoraSchema: exige detalle operativo de tareas realizadas', () => {
  const bitacoraValida = {
    tareasRealizadas: 'Paseo de 5 perros del patio sur y cepillado general.',
    incidentes: 'Ninguno.',
    observaciones: 'Todos con buena energía.'
  };

  const parsed = registrarBitacoraSchema.parse(bitacoraValida);
  assert.ok(parsed.tareasRealizadas.length >= 5);

  const bitacoraInvalida = { tareasRealizadas: '' };
  assert.equal(registrarBitacoraSchema.safeParse(bitacoraInvalida).success, false);
});
