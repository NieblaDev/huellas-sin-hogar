import assert from 'node:assert/strict';
import test from 'node:test';
import nodemailer from 'nodemailer';
import { trasladoExternoSchema } from '../src/schemas/canil.schema.js';
import { prepararCorreoTraslado } from '../src/services/correoTraslado.service.js';

test('el correo de destino es obligatorio solo para la protectora aliada', () => {
  const base = { animalId: 7, destinoNombre: 'Fundación Aliada', motivo: 'Coordinación de cupo' };
  const protectora = { ...base, tipo: 'PROTECTORA_ALIADA' };
  assert.equal(trasladoExternoSchema.safeParse(protectora).success, false);
  assert.equal(trasladoExternoSchema.safeParse({ ...protectora, destinoEmail: '555-0123' }).success, false);
  assert.equal(trasladoExternoSchema.safeParse({ ...protectora, destinoEmail: 'equipo@example.test' }).success, true);
  assert.equal(trasladoExternoSchema.safeParse({ ...base, tipo: 'HOGAR_TEMPORAL' }).success, true);
});

test('genera un correo con la ficha externa en PDF y el aviso de aprobación pendiente', async () => {
  const correo = prepararCorreoTraslado({
    id: 12,
    destinoEmail: 'equipo@example.test',
    destinoNombre: 'Fundación Aliada',
    animal: {
      id: 7, nombre: 'Luna', especie: 'Perro', activo: true, estadoSalud: 'NORMAL',
      nota: 'NOTA_PRIVADA', comportamiento: 'COMENTARIO_PRIVADO', chip: 'CHIP_PRIVADO',
      traslados: [{ motivo: 'MOTIVO_PRIVADO' }]
    }
  }, 'refugio@example.test');
  assert.match(correo.text, /pendiente de aprobación/);
  const [adjunto] = correo.attachments;
  const pdf = adjunto.content.toString('latin1');
  assert.match(pdf, /^%PDF-/);
  assert.match(pdf, /Luna/);
  assert.doesNotMatch(pdf, /NOTA_PRIVADA|COMENTARIO_PRIVADO|CHIP_PRIVADO|MOTIVO_PRIVADO/);

  const smtpSimulado = nodemailer.createTransport({ streamTransport: true, buffer: true });
  const resultado = await smtpSimulado.sendMail(correo);
  const mime = resultado.message.toString();
  assert.match(mime, /To: equipo@example\.test/);
  assert.match(mime, /Content-Type: application\/pdf/);
  assert.match(mime, /ficha-animal-7\.pdf/);
});
