import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) throw new Error('Define TEST_DATABASE_URL con una base PostgreSQL local de pruebas migrada.');
const parsedUrl = new URL(testUrl);
if (!['localhost', '127.0.0.1', '[::1]'].includes(parsedUrl.hostname) || !parsedUrl.pathname.includes('test')) {
  throw new Error('TEST_DATABASE_URL debe apuntar a localhost y el nombre de la base debe incluir test.');
}
const testSchema = `rf2_integration_${randomUUID().replace(/-/g, '')}`;
const admin = new PrismaClient({ datasources: { db: { url: testUrl } } });
parsedUrl.searchParams.set('schema', testSchema);
process.env.DATABASE_URL = parsedUrl.toString();
process.env.JWT_SECRET = 'rf2-local-test-secret';

const { default: prisma } = await import('../src/config/prisma.js');
const { default: routes } = await import('../src/routes/adopcion.routes.js');

const run = `RF2${Date.now().toString(36).toUpperCase()}`;
const usuarios = [];
let responsable, server, base;
let secuencia = 0;
const identidad = () => `${run}${++secuencia}`;
const token = usuario => jwt.sign({ id: usuario.id, rol: usuario.rol }, process.env.JWT_SECRET, { expiresIn: '5m' });

const request = async (path, { usuario = responsable, method = 'GET', data, bearer } = {}) => {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(usuario && { Authorization: `Bearer ${bearer || token(usuario)}` })
    },
    ...(data && { body: JSON.stringify(data) })
  });
  return { status: response.status, data: await response.json() };
};

const prepararAdopcionConcretada = async () => {
  const canil = await prisma.canil.create({
    data: { codigo: `C-${identidad()}`, nombre: 'Canil Test', sector: 'General', estado: 'OCUPADO' }
  });
  const animal = await prisma.animal.create({
    data: { nombre: `Animal ${identidad()}`, especie: 'Perro', sexo: 'Macho', edad: '3 años', chip: `CHIP-${identidad()}`, canilId: canil.id, nota: 'Ficha clinica completa' }
  });
  const postulante = await prisma.postulante.create({
    data: { nombre: `Adoptante ${identidad()}`, rut: `RUT-${identidad()}`, tipoIdentificacion: 'OTRO', email: 'adoptante@test.com', telefono: '+56911223344' }
  });
  const solicitud = await prisma.solicitudAdopcion.create({
    data: {
      animalId: animal.id,
      postulanteId: postulante.id,
      registradoPorId: responsable.id,
      estado: 'APROBADA',
      motivacion: 'Motivacion valida para la adopcion del animal',
      datosPostulante: { nombre: postulante.nombre, rut: postulante.rut }
    }
  });

  // Concretar entrega mediante actualizarEtapa (simulando paso ENTREGAR)
  const { actualizarEtapa } = await import('../src/services/adopcionEtapa.service.js');
  const entrega = await actualizarEtapa(solicitud.id, {
    accion: 'ENTREGAR',
    fecha: new Date().toISOString(),
    observaciones: 'Entrega en el refugio confirmada.',
    actualizadoEn: solicitud.actualizadoEn.toISOString()
  }, responsable, '127.0.0.1');

  return { animal, postulante, solicitud, adopcion: entrega.adopcion, canil };
};

before(async () => {
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${testSchema}"`);
  execFileSync(process.execPath, [
    fileURLToPath(new URL('../node_modules/prisma/build/index.js', import.meta.url)),
    'migrate', 'deploy', '--schema', fileURLToPath(new URL('../prisma/schema.prisma', import.meta.url))
  ], { env: { ...process.env, CHECKPOINT_DISABLE: '1' }, stdio: 'pipe' });

  responsable = await prisma.usuario.create({
    data: { email: `${run}-admin@example.test`, nombre: `Admin ${run}`, password: 'hash', rol: 'DIRECTORA', activo: true }
  });
  usuarios.push(responsable);

  const app = express();
  app.use(express.json());
  app.use('/api/adopciones', routes);
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  base = `http://127.0.0.1:${server.address().port}/api/adopciones`;
});

after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await prisma.$disconnect();
  await admin.$executeRawUnsafe(`DROP SCHEMA "${testSchema}" CASCADE`);
  await admin.$disconnect();
});

test('programación automática: al concretar adopción se crean seguimientos obligatorios a +15 y +30 días', async () => {
  const { adopcion } = await prepararAdopcionConcretada();
  const seguimientos = await prisma.seguimientoAdopcion.findMany({
    where: { adopcionId: adopcion.id },
    orderBy: { diasProgramados: 'asc' }
  });

  assert.equal(seguimientos.length, 2);
  assert.equal(seguimientos[0].tipoSeguimiento, 'SEGUIMIENTO_15_DIAS');
  assert.equal(seguimientos[0].diasProgramados, 15);
  assert.equal(seguimientos[0].estado, 'PENDIENTE');

  assert.equal(seguimientos[1].tipoSeguimiento, 'SEGUIMIENTO_30_DIAS');
  assert.equal(seguimientos[1].diasProgramados, 30);
  assert.equal(seguimientos[1].estado, 'PENDIENTE');

  // Comprobar diferencia de días respecto a la adopción
  const fechaAdopcion = new Date(adopcion.fecha).getTime();
  const diff15 = Math.round((new Date(seguimientos[0].fechaProgramada).getTime() - fechaAdopcion) / (24 * 3600 * 1000));
  const diff30 = Math.round((new Date(seguimientos[1].fechaProgramada).getTime() - fechaAdopcion) / (24 * 3600 * 1000));
  assert.equal(diff15, 15);
  assert.equal(diff30, 30);
});

test('listar seguimientos: permite filtrar por adopción y por estado', async () => {
  const { adopcion } = await prepararAdopcionConcretada();

  const resAdopcion = await request(`/seguimientos?adopcionId=${adopcion.id}`);
  assert.equal(resAdopcion.status, 200);
  assert.equal(resAdopcion.data.seguimientos.length, 2);

  const resPendientes = await request('/seguimientos?estado=PENDIENTE');
  assert.equal(resPendientes.status, 200);
  assert.ok(resPendientes.data.seguimientos.length >= 2);
  assert.ok(resPendientes.data.seguimientos.every(s => s.estado === 'PENDIENTE'));
});

test('registrar seguimiento: guarda contacto realizado, responsable, estado del animal y completa la etapa', async () => {
  const { adopcion } = await prepararAdopcionConcretada();
  const [seg15] = await prisma.seguimientoAdopcion.findMany({ where: { adopcionId: adopcion.id } });

  const payload = {
    fecha: new Date().toISOString(),
    canalContacto: 'WhatsApp',
    estadoAnimal: 'Adaptación excelente, sociable y comiendo adecuadamente.',
    resultado: 'Favorable - Adoptante muy satisfecho',
    observaciones: 'Fotos enviadas muestran al perro jugando en el patio.'
  };

  const res = await request(`/seguimientos/${seg15.id}/registrar`, { method: 'POST', data: payload });
  assert.equal(res.status, 200);
  assert.equal(res.data.estado, 'COMPLETADO');
  assert.equal(res.data.canalContacto, 'WHATSAPP');
  assert.equal(res.data.resultado, payload.resultado);
  assert.equal(res.data.responsable.id, responsable.id);

  // Verificar en base de datos e intentos registrados
  const enDb = await prisma.seguimientoAdopcion.findUnique({
    where: { id: seg15.id },
    include: { intentos: true }
  });
  assert.equal(enDb.estado, 'COMPLETADO');
  assert.equal(enDb.intentos.length, 1);
  assert.equal(enDb.intentos[0].contactado, true);

  // Intentar registrar nuevamente debe ser rechazado
  const resDup = await request(`/seguimientos/${seg15.id}/registrar`, { method: 'POST', data: payload });
  assert.equal(resDup.status, 409);
});

test('reprogramar intento: incrementa fallos y al alcanzar el límite activa alerta "sin contacto"', async () => {
  const { adopcion } = await prepararAdopcionConcretada();
  const [, seg30] = await prisma.seguimientoAdopcion.findMany({
    where: { adopcionId: adopcion.id },
    orderBy: { diasProgramados: 'asc' }
  });

  const fechaFutura1 = new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString();
  const fechaFutura2 = new Date(Date.now() + 4 * 24 * 3600 * 1000).toISOString();
  const fechaFutura3 = new Date(Date.now() + 6 * 24 * 3600 * 1000).toISOString();

  // Intento fallido 1
  const r1 = await request(`/seguimientos/${seg30.id}/reprogramar`, {
    method: 'POST',
    data: {
      canalContacto: 'LLAMADA_TELEFONICA',
      resultado: 'NO_RESPONDE',
      observaciones: 'Buzón de voz directo, se reagenda.',
      fechaReprogramada: fechaFutura1
    }
  });
  assert.equal(r1.status, 200);
  assert.equal(r1.data.seguimiento.intentosFallidos, 1);
  assert.equal(r1.data.seguimiento.estado, 'REPROGRAMADO');
  assert.equal(r1.data.alertaGenerada, false);

  // Intento fallido 2
  const r2 = await request(`/seguimientos/${seg30.id}/reprogramar`, {
    method: 'POST',
    data: {
      canalContacto: 'WHATSAPP',
      resultado: 'SIN_RESPUESTA',
      observaciones: 'Mensaje sin leer.',
      fechaReprogramada: fechaFutura2
    }
  });
  assert.equal(r2.status, 200);
  assert.equal(r2.data.seguimiento.intentosFallidos, 2);
  assert.equal(r2.data.seguimiento.estado, 'REPROGRAMADO');
  assert.equal(r2.data.alertaGenerada, false);

  // Intento fallido 3 (alcanza el límite por defecto = 3)
  const r3 = await request(`/seguimientos/${seg30.id}/reprogramar`, {
    method: 'POST',
    data: {
      canalContacto: 'LLAMADA',
      resultado: 'TELEFONO_APAGADO',
      observaciones: 'Número apagado o fuera de servicio.',
      fechaReprogramada: fechaFutura3
    }
  });
  assert.equal(r3.status, 200);
  assert.equal(r3.data.seguimiento.intentosFallidos, 3);
  assert.equal(r3.data.seguimiento.estado, 'SIN_CONTACTO');
  assert.equal(r3.data.seguimiento.alertaSinContacto, true);
  assert.equal(r3.data.alertaGenerada, true);

  // Debe aparecer en el filtro de alertas activas
  const listAlerta = await request('/seguimientos?alertaSinContacto=true');
  assert.equal(listAlerta.status, 200);
  assert.ok(listAlerta.data.seguimientos.some(s => s.id === seg30.id));
});

test('configuración de límite de intentos: consultar y actualizar límite global', async () => {
  const getCfg = await request('/seguimientos/configuracion');
  assert.equal(getCfg.status, 200);
  assert.equal(getCfg.data.clave, 'SEGUIMIENTO_MAX_INTENTOS');

  const putCfg = await request('/seguimientos/configuracion', {
    method: 'PUT',
    data: { limite: 4 }
  });
  assert.equal(putCfg.status, 200);
  assert.equal(putCfg.data.limite, 4);

  const getUpdated = await request('/seguimientos/configuracion');
  assert.equal(getUpdated.data.limite, 4);
});

test('devolución y reingreso: devuelve animal, reasigna canil, actualiza antecedentes y conserva ficha', async () => {
  const { animal, postulante, adopcion } = await prepararAdopcionConcretada();
  const nuevoCanil = await prisma.canil.create({
    data: { codigo: `C-REV-${identidad()}`, nombre: 'Canil Reingreso', sector: 'General', estado: 'LIBRE' }
  });

  const payload = {
    adopcionId: adopcion.id,
    fecha: new Date().toISOString(),
    motivo: 'El adoptante presentó alergias severas no previstas.',
    estadoAnimal: 'Buen estado general de nutrición y peso.',
    observacionesPostulante: 'Devolución de mutuo acuerdo. Persona colaboradora pero no apta para animales con pelo largo.',
    canilId: nuevoCanil.id
  };

  const res = await request('/devoluciones', { method: 'POST', data: payload });
  assert.equal(res.status, 201);
  assert.equal(res.data.devolucion.adopcionId, adopcion.id);
  assert.equal(res.data.devolucion.motivo, payload.motivo);
  assert.equal(res.data.animal.estadoAdopcion, 'EN_REFUGIO');
  assert.equal(res.data.animal.canilId, nuevoCanil.id);

  // Verificar que la adopción quedó marcada como devuelta
  const adopcionDb = await prisma.adopcion.findUnique({ where: { id: adopcion.id } });
  assert.equal(adopcionDb.devolucion, true);
  assert.equal(adopcionDb.etapa, 'Devuelto');

  // Verificar que el canil quedó OCUPADO
  const canilDb = await prisma.canil.findUnique({ where: { id: nuevoCanil.id } });
  assert.equal(canilDb.estado, 'OCUPADO');

  // Verificar que la ficha del animal se conservó intacta
  const animalDb = await prisma.animal.findUnique({ where: { id: animal.id } });
  assert.equal(animalDb.nombre, animal.nombre);
  assert.equal(animalDb.chip, animal.chip);
  assert.equal(animalDb.nota, 'Ficha clinica completa');

  // Verificar que el postulante ahora registra antecedentes de devolución para futuras alertas
  const antecedentes = await request(`/antecedentes?tipoIdentificacion=OTRO&identificacion=${postulante.rut}`);
  assert.equal(antecedentes.status, 200);
  assert.ok(antecedentes.data.alertas.some(a => a.codigo === 'DEVOLUCIONES_PREVIAS'));
  assert.ok(antecedentes.data.devolucionesPrevias.length >= 1);

  // Impedir registrar devolución repetida
  const resDup = await request('/devoluciones', { method: 'POST', data: payload });
  assert.equal(resDup.status, 409);
});
