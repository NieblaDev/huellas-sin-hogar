import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

// Cada ejecución usa un esquema propio: nunca comparte postulantes con las pruebas manuales.
const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) throw new Error('Define TEST_DATABASE_URL con una base PostgreSQL local de pruebas migrada.');
const parsedUrl = new URL(testUrl);
if (!['localhost', '127.0.0.1', '[::1]'].includes(parsedUrl.hostname) || !parsedUrl.pathname.includes('test')) {
  throw new Error('TEST_DATABASE_URL debe apuntar a localhost y el nombre de la base debe incluir test.');
}
const testSchema = `rf1_integration_${randomUUID().replace(/-/g, '')}`;
const admin = new PrismaClient({ datasources: { db: { url: testUrl } } });
parsedUrl.searchParams.set('schema', testSchema);
process.env.DATABASE_URL = parsedUrl.toString();
process.env.JWT_SECRET = 'rf1-local-test-secret';
const { default: prisma } = await import('../src/config/prisma.js');
const { default: routes } = await import('../src/routes/adopcion.routes.js');
const run = `RF1${Date.now().toString(36).toUpperCase()}`;
const usuarios = [];
const animales = [];
let responsable, encargada, veterinaria, inactivo, voluntario, server, base;
let schemaCreado = false;
let secuencia = 0;
const identidad = () => `${run}${++secuencia}`;
const token = usuario => jwt.sign({ id: usuario.id, rol: usuario.rol }, process.env.JWT_SECRET, { expiresIn: '5m' });
const body = (identificacion = identidad(), animalId = animales[0].id) => ({
  postulante: { tipoIdentificacion: 'OTRO', identificacion, nombre: `Postulante ${run}`, email: 'postulante@example.test', telefono: '+56 9 1234 5678', direccion: 'Calle de prueba 123' },
  animalId, motivacion: 'Dispongo de un hogar y tiempo para cuidar al animal.'
});
const request = async (path, { usuario = responsable, method = 'GET', data, bearer } = {}) => {
  const response = await fetch(`${base}${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...(usuario && { Authorization: `Bearer ${bearer || token(usuario)}` }) },
    ...(data && { body: JSON.stringify(data) })
  });
  return { status: response.status, data: await response.json() };
};
const crear = (data = body(), options = {}) => request('/solicitudes', { method: 'POST', data, ...options });
const crearAnimal = async () => {
  const animal = await prisma.animal.create({ data: { nombre: `Animal ${run}`, especie: 'Perro', sexo: 'Macho', edad: '2 años', nota: 'Ficha original intacta' } });
  animales.push(animal); return animal;
};

before(async () => {
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${testSchema}"`);
  schemaCreado = true;
  execFileSync(process.execPath, [
    fileURLToPath(new URL('../node_modules/prisma/build/index.js', import.meta.url)),
    'migrate', 'deploy', '--schema', fileURLToPath(new URL('../prisma/schema.prisma', import.meta.url))
  ], { env: { ...process.env, CHECKPOINT_DISABLE: '1' }, stdio: 'pipe' });
  for (const [rol, activo] of [['DIRECTORA', true], ['ENCARGADA_ADOPCIONES', true], ['VETERINARIA', true], ['DIRECTORA', false], ['VOLUNTARIO_AVANZADO', true]]) {
    usuarios.push(await prisma.usuario.create({ data: { email: `${run}-${usuarios.length}@example.test`, nombre: `Staff ${run}`, password: 'unused-test-password', rol, activo } }));
  }
  [responsable, encargada, veterinaria, inactivo, voluntario] = usuarios;
  await crearAnimal();
  const app = express();
  app.use(express.json()); app.use('/api/adopciones', routes);
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  base = `http://127.0.0.1:${server.address().port}/api/adopciones`;
});

after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await prisma.$disconnect();
  try {
    if (schemaCreado) await admin.$executeRawUnsafe(`DROP SCHEMA "${testSchema}" CASCADE`);
  } finally {
    await admin.$disconnect();
  }
});

const nueva = async (animal = null) => {
  animal ||= await crearAnimal();
  const res = await crear(body(identidad(), animal.id));
  assert.equal(res.status, 201);
  return res.data.solicitud;
};
const paso = async (solicitud, accion, extra = {}, options = {}) => request(`/solicitudes/${solicitud.id}/etapas`, {
  method: 'POST', data: { accion, actualizadoEn: solicitud.actualizadoEn, fecha: new Date().toISOString(), observaciones: `Registro de ${accion}`, ...(accion === 'EVALUAR' && { resultadoEvaluacion: 'CUMPLE' }), ...extra }, ...options
});
const avanzar = async (solicitud, accion, extra = {}) => {
  const result = await paso(solicitud, accion, extra);
  assert.equal(result.status, 200, JSON.stringify(result.data));
  return result.data.solicitud;
};
const aprobar = async s => {
  s = await avanzar(s, 'EVALUAR');
  s = await avanzar(s, 'REGISTRAR_VISITA');
  return avanzar(s, 'APROBAR');
};

test('el flujo con visita conserva ficha, registra responsable y libera el canil solo en la entrega', async () => {
  const canil = await prisma.canil.create({ data: { codigo: identidad(), nombre: 'Canil prueba', estado: 'OCUPADO' } });
  const animal = await crearAnimal();
  await prisma.animal.update({ where: { id: animal.id }, data: { canilId: canil.id } });
  let s = await nueva(animal);
  s = await avanzar(s, 'EVALUAR');
  s = await avanzar(s, 'AGENDAR_VISITA', { fecha: new Date(Date.now() + 86400000).toISOString() });
  s = await avanzar(s, 'REGISTRAR_VISITA');
  s = await avanzar(s, 'APROBAR');
  assert.equal(await prisma.adopcion.count({ where: { solicitudId: s.id } }), 0);
  assert.equal((await prisma.canil.findUnique({ where: { id: canil.id } })).estado, 'OCUPADO');
  s = await avanzar(s, 'ENTREGAR');
  assert.equal(s.estado, 'ENTREGADA');
  const final = await prisma.animal.findUnique({ where: { id: animal.id } });
  assert.deepEqual(final, { ...animal, estadoAdopcion: 'ADOPTADO', canilId: null });
  assert.equal((await prisma.canil.findUnique({ where: { id: canil.id } })).estado, 'LIBRE');
  const detalle = (await request(`/solicitudes/${s.id}`)).data.solicitud;
  assert.equal(detalle.adopcion.responsable.id, responsable.id);
  assert.equal(detalle.etapas.length, 5);
  assert.equal(detalle.etapas.at(-1).fecha, detalle.adopcion.fecha);
  assert.ok(detalle.etapas.every(e => e.responsable.id === responsable.id));
  const disponibles = (await request('/animales-disponibles')).data;
  assert.ok(!disponibles.some(a => a.id === animal.id));
  assert.equal((await crear(body(identidad(), animal.id))).status, 404);
});

test('exige visita o motivo explícito antes de aprobar y conserva la omisión en el historial', async () => {
  let s = await avanzar(await nueva(), 'EVALUAR');
  assert.equal((await paso(s, 'APROBAR')).status, 409);
  assert.equal((await paso(s, 'OMITIR_VISITA')).status, 400);
  assert.equal((await paso(s, 'OMITIR_VISITA', { motivoOmision: '   ' })).status, 400);
  s = await avanzar(s, 'OMITIR_VISITA', { motivoOmision: 'Hogar previamente visitado y documentado.' });
  assert.equal(s.visitaOmitida, true);
  const detalle = (await request(`/solicitudes/${s.id}`)).data.solicitud;
  assert.equal(detalle.etapas.at(-1).motivoOmision, s.motivoOmisionVisita);
  s = await avanzar(s, 'APROBAR');
  s = await avanzar(s, 'ENTREGAR');
  assert.equal(s.estado, 'ENTREGADA');
});

test('agendar una nueva visita invalida la omisión anterior y requiere registrar la visita', async () => {
  let s = await avanzar(await nueva(), 'EVALUAR');
  s = await avanzar(s, 'OMITIR_VISITA', { motivoOmision: 'Primera justificación.' });
  s = await avanzar(s, 'AGENDAR_VISITA', { fecha: new Date(Date.now() + 86400000).toISOString() });
  assert.equal(s.visitaOmitida, false);
  assert.equal(s.motivoOmisionVisita, null);
  assert.equal((await paso(s, 'APROBAR')).status, 409);
  assert.ok((await request(`/solicitudes/${s.id}`)).data.solicitud.etapas.some(e => e.accion === 'OMITIR_VISITA'));
});

test('valida permisos, fechas, campos de control y transiciones', async () => {
  let s = await nueva();
  for (const usuario of [veterinaria, inactivo, voluntario]) assert.equal((await paso(s, 'EVALUAR', {}, { usuario })).status, 403);
  assert.equal((await paso(s, 'EVALUAR', {}, { usuario: null })).status, 401);
  assert.equal((await paso(s, 'EVALUAR', { responsableId: encargada.id })).status, 400);
  assert.equal((await paso(s, 'ENTREGAR')).status, 409);
  assert.equal((await paso(s, 'EVALUAR', { fecha: '2000-01-01T00:00:00.000Z' })).status, 400);
  assert.equal((await paso(s, 'EVALUAR', { fecha: new Date(Date.now() + 86400000).toISOString() })).status, 400);
  const res = await paso(s, 'EVALUAR', {}, { usuario: encargada });
  assert.equal(res.status, 200);
  s = res.data.solicitud;
  assert.equal((await request(`/solicitudes/${s.id}`)).data.solicitud.etapas[0].responsable.id, encargada.id);
  s = await avanzar(s, 'RECHAZAR');
  assert.equal((await paso(s, 'EVALUAR')).status, 409);
  assert.equal((await prisma.animal.findUnique({ where: { id: s.animalId } })).estadoAdopcion, 'EN_REFUGIO');
  const cancelada = await nueva();
  const baja = await request(`/solicitudes/${cancelada.id}`, { method: 'DELETE', data: { actualizadoEn: cancelada.actualizadoEn } });
  assert.equal((await paso(baja.data.solicitud, 'EVALUAR')).status, 409);
});

test('rechaza entrega si el postulante o animal fue dado de baja después de aprobar', async () => {
  const s = await aprobar(await nueva());
  await prisma.postulante.update({ where: { id: s.postulanteId }, data: { activo: false } });
  assert.equal((await paso(s, 'ENTREGAR')).status, 409);
  await prisma.postulante.update({ where: { id: s.postulanteId }, data: { activo: true } });
  await prisma.animal.update({ where: { id: s.animalId }, data: { activo: false } });
  assert.equal((await paso(s, 'ENTREGAR')).status, 409);
  assert.equal(await prisma.adopcion.count({ where: { solicitudId: s.id } }), 0);
});

test('dos entregas simultáneas de una solicitud producen una sola adopción', async () => {
  const s = await aprobar(await nueva());
  const results = await Promise.all([paso(s, 'ENTREGAR'), paso(s, 'ENTREGAR')]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  assert.equal(await prisma.adopcion.count({ where: { solicitudId: s.id } }), 1);
  assert.equal(await prisma.etapaSolicitudAdopcion.count({ where: { solicitudId: s.id, accion: 'ENTREGAR' } }), 1);
});

test('dos solicitudes del mismo animal no pueden concretar dos adopciones', async () => {
  const animal = await crearAnimal();
  const a = await aprobar(await nueva(animal));
  const b = await aprobar(await nueva(animal));
  const results = await Promise.all([paso(a, 'ENTREGAR'), paso(b, 'ENTREGAR')]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  assert.equal(await prisma.adopcion.count({ where: { animalId: animal.id } }), 1);
});

test('un fallo durante la entrega revierte adopción, animal, canil, etapa y auditoría', async () => {
  const canil = await prisma.canil.create({ data: { codigo: identidad(), nombre: 'Canil rollback', estado: 'OCUPADO' } });
  const animal = await crearAnimal();
  await prisma.animal.update({ where: { id: animal.id }, data: { canilId: canil.id } });
  const s = await aprobar(await nueva(animal));
  const auditorias = await prisma.auditoria.count();
  await prisma.$executeRawUnsafe(`CREATE FUNCTION fallo_auditoria_rf1() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entidad = 'Adopcion' THEN RAISE EXCEPTION 'Fallo de prueba'; END IF; RETURN NEW; END; $$`);
  await prisma.$executeRawUnsafe('CREATE TRIGGER fallo_auditoria_rf1 BEFORE INSERT ON auditorias FOR EACH ROW EXECUTE FUNCTION fallo_auditoria_rf1()');
  try {
    assert.equal((await paso(s, 'ENTREGAR')).status, 500);
    assert.equal(await prisma.adopcion.count({ where: { solicitudId: s.id } }), 0);
    assert.equal((await prisma.solicitudAdopcion.findUnique({ where: { id: s.id } })).estado, 'APROBADA');
    assert.equal((await prisma.animal.findUnique({ where: { id: animal.id } })).canilId, canil.id);
    assert.equal((await prisma.animal.findUnique({ where: { id: animal.id } })).estadoAdopcion, 'EN_REFUGIO');
    assert.equal((await prisma.canil.findUnique({ where: { id: canil.id } })).estado, 'OCUPADO');
    assert.equal(await prisma.etapaSolicitudAdopcion.count({ where: { solicitudId: s.id, accion: 'ENTREGAR' } }), 0);
    assert.equal(await prisma.auditoria.count(), auditorias);
  } finally {
    await prisma.$executeRawUnsafe('DROP TRIGGER fallo_auditoria_rf1 ON auditorias');
    await prisma.$executeRawUnsafe('DROP FUNCTION fallo_auditoria_rf1()');
  }
});


test('evaluación explícita: pendiente bloquea visitas y aprobación, cumple permite continuar', async () => {
  let s = await nueva();
  assert.equal((await paso(s, 'EVALUAR', { resultadoEvaluacion: undefined })).status, 400);
  assert.equal((await paso(s, 'EVALUAR', { resultadoEvaluacion: 'OTRO' })).status, 400);
  s = await avanzar(s, 'EVALUAR', { resultadoEvaluacion: 'PENDIENTE', observaciones: 'Falta acreditar las condiciones del hogar.' });
  assert.equal(s.estado, 'EN_EVALUACION');
  const pendientes = s;
  for (const accion of ['AGENDAR_VISITA', 'REGISTRAR_VISITA', 'OMITIR_VISITA', 'APROBAR']) {
    const extra = accion === 'AGENDAR_VISITA' ? { fecha: new Date(Date.now() + 86400000).toISOString() }
      : accion === 'OMITIR_VISITA' ? { motivoOmision: 'Hogar conocido.' } : {};
    assert.equal((await paso(s, accion, extra)).status, 409);
  }
  s = await avanzar(s, 'EVALUAR', { resultadoEvaluacion: 'PENDIENTE' });
  s = await avanzar(s, 'EVALUAR');
  assert.equal((await paso(pendientes, 'EVALUAR')).status, 409);
  const detalle = (await request(`/solicitudes/${s.id}`)).data.solicitud;
  assert.deepEqual(detalle.etapas.map(e => e.resultadoEvaluacion), ['PENDIENTE', 'PENDIENTE', 'CUMPLE']);
  assert.ok(detalle.etapas.every(e => e.responsable.id === responsable.id));
  assert.equal((await paso(s, 'REGISTRAR_VISITA', { resultadoEvaluacion: 'CUMPLE' })).status, 400);
  s = await avanzar(s, 'REGISTRAR_VISITA');
  s = await avanzar(s, 'APROBAR');
  assert.equal(s.estado, 'APROBADA');
});

test('no cumple rechaza con motivo e historial, sin modificar animal ni canil', async () => {
  const canil = await prisma.canil.create({ data: { codigo: identidad(), nombre: 'Canil evaluación', estado: 'OCUPADO' } });
  const animal = await crearAnimal();
  await prisma.animal.update({ where: { id: animal.id }, data: { canilId: canil.id } });
  let s = await nueva(animal);
  assert.equal((await paso(s, 'EVALUAR', { resultadoEvaluacion: 'NO_CUMPLE', observaciones: '  ' })).status, 400);
  s = await avanzar(s, 'EVALUAR', { resultadoEvaluacion: 'NO_CUMPLE', observaciones: 'No dispone de un espacio seguro para el animal.' });
  assert.equal(s.estado, 'RECHAZADA');
  const detalle = (await request(`/solicitudes/${s.id}`)).data.solicitud;
  assert.equal(detalle.etapas[0].resultadoEvaluacion, 'NO_CUMPLE');
  assert.match(detalle.etapas[0].observaciones, /espacio seguro/);
  assert.equal((await paso(s, 'EVALUAR')).status, 409);
  assert.equal((await prisma.animal.findUnique({ where: { id: animal.id } })).canilId, canil.id);
  assert.equal((await prisma.canil.findUnique({ where: { id: canil.id } })).estado, 'OCUPADO');
  assert.equal(await prisma.adopcion.count({ where: { solicitudId: s.id } }), 0);
});

test('después de aprobar solo se permite cancelar con motivo o concretar, nunca rechazar', async () => {
  const canil = await prisma.canil.create({ data: { codigo: identidad(), nombre: 'Canil cancelación', estado: 'OCUPADO' } });
  const animal = await crearAnimal();
  await prisma.animal.update({ where: { id: animal.id }, data: { canilId: canil.id } });
  let s = await nueva(animal);
  assert.equal((await paso(s, 'CANCELAR')).status, 409);
  s = await aprobar(s);
  assert.equal((await paso(s, 'RECHAZAR')).status, 409);
  assert.equal((await paso(s, 'CANCELAR', { observaciones: '' })).status, 400);
  await prisma.postulante.update({ where: { id: s.postulanteId }, data: { activo: false } });
  s = await avanzar(s, 'CANCELAR', { observaciones: 'El postulante desistió antes de retirar al animal.' });
  assert.equal(s.estado, 'CANCELADA');
  const detalle = (await request(`/solicitudes/${s.id}`)).data.solicitud;
  assert.equal(detalle.etapas.at(-1).accion, 'CANCELAR');
  assert.match(detalle.etapas.at(-1).observaciones, /desistió/);
  assert.equal((await paso(s, 'ENTREGAR')).status, 409);
  assert.equal((await paso(s, 'CANCELAR')).status, 409);
  assert.equal((await prisma.animal.findUnique({ where: { id: animal.id } })).canilId, canil.id);
  assert.equal((await prisma.canil.findUnique({ where: { id: canil.id } })).estado, 'OCUPADO');
  assert.equal(await prisma.adopcion.count({ where: { solicitudId: s.id } }), 0);
  const auditoria = await prisma.auditoria.findFirst({ where: { entidad: 'SolicitudAdopcion', entidadId: s.id }, orderBy: { id: 'desc' } });
  assert.equal(auditoria.valorNuevo.accion, 'CANCELAR');
});

test('una evaluación antigua sin resultado puede completarse sin borrar una visita registrada', async () => {
  let s = await nueva();
  // Representa datos guardados antes de añadir el resultado de evaluación.
  await prisma.etapaSolicitudAdopcion.create({ data: { solicitudId: s.id, accion: 'EVALUAR', estadoAnterior: 'RECIBIDA', estadoNuevo: 'EN_EVALUACION', fecha: new Date(), observaciones: 'Evaluación anterior sin resultado explícito', responsableId: responsable.id } });
  await prisma.etapaSolicitudAdopcion.create({ data: { solicitudId: s.id, accion: 'REGISTRAR_VISITA', estadoAnterior: 'EN_EVALUACION', estadoNuevo: 'VISITA_REALIZADA', fecha: new Date(), observaciones: 'Visita registrada antes del cambio', responsableId: responsable.id } });
  const existente = await prisma.solicitudAdopcion.update({ where: { id: s.id }, data: { estado: 'VISITA_REALIZADA' } });
  s = { ...existente, actualizadoEn: existente.actualizadoEn.toISOString() };
  assert.equal((await paso(s, 'APROBAR')).status, 409);
  s = await avanzar(s, 'EVALUAR');
  assert.equal(s.estado, 'VISITA_REALIZADA');
  const detalle = (await request(`/solicitudes/${s.id}`)).data.solicitud;
  assert.equal(detalle.etapas[0].resultadoEvaluacion, null);
  assert.equal(detalle.etapas[1].accion, 'REGISTRAR_VISITA');
  assert.equal(detalle.etapas.at(-1).resultadoEvaluacion, 'CUMPLE');
  s = await avanzar(s, 'APROBAR');
  assert.equal(s.estado, 'APROBADA');
});

test('dejar la evaluación pendiente invalida la omisión y exige resolver de nuevo la visita', async () => {
  let s = await avanzar(await nueva(), 'EVALUAR');
  s = await avanzar(s, 'OMITIR_VISITA', { motivoOmision: 'Hogar ya conocido.' });
  s = await avanzar(s, 'EVALUAR', { resultadoEvaluacion: 'PENDIENTE', observaciones: 'Cambió el domicilio; falta nueva información.' });
  assert.equal(s.visitaOmitida, false);
  s = await avanzar(s, 'EVALUAR');
  assert.equal((await paso(s, 'APROBAR')).status, 409);
});
