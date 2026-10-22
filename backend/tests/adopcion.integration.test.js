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

test('todas las rutas exigen autenticación y rol autorizado', async () => {
  const endpoints = ['/solicitudes', '/solicitudes/1', '/antecedentes?tipoIdentificacion=OTRO&identificacion=ABC123', '/animales-disponibles'];
  for (const endpoint of endpoints) {
    assert.equal((await request(endpoint, { usuario: null })).status, 401);
    for (const usuario of [veterinaria, inactivo, voluntario]) assert.equal((await request(endpoint, { usuario })).status, 403);
  }
  assert.equal((await crear(body(), { usuario: null })).status, 401);
  for (const usuario of [veterinaria, inactivo, voluntario]) assert.equal((await crear(body(), { usuario })).status, 403);
  assert.equal((await request('/solicitudes', { bearer: 'token-invalido' })).status, 403);
});

test('el rol y estado activo actuales prevalecen sobre un JWT anterior', async () => {
  const anterior = token(encargada);
  await prisma.usuario.update({ where: { id: encargada.id }, data: { rol: 'VOLUNTARIO_NOVATO' } });
  assert.equal((await request('/solicitudes', { usuario: encargada, bearer: anterior })).status, 403);
  await prisma.usuario.update({ where: { id: encargada.id }, data: { rol: 'ENCARGADA_ADOPCIONES', activo: false } });
  assert.equal((await crear(body(), { usuario: encargada, bearer: anterior })).status, 403);
  await prisma.usuario.update({ where: { id: encargada.id }, data: { activo: true } });
});

test('crea una solicitud, registra al responsable y permite consultar su detalle', async () => {
  const payload = body();
  const result = await crear(payload, { usuario: encargada });
  assert.equal(result.status, 201);
  const s = result.data.solicitud;
  assert.equal(s.registradoPorId, encargada.id);
  assert.equal(s.estado, 'RECIBIDA');
  assert.equal(s.animalId, payload.animalId);
  assert.deepEqual(s.datosPostulante, payload.postulante);
  assert.ok(s.creadoEn);
  assert.equal(await prisma.auditoria.count({ where: { entidad: 'SolicitudAdopcion', entidadId: s.id, usuarioId: encargada.id } }), 1);
  assert.equal('password' in s.registradoPor, false);
  const detalle = await request(`/solicitudes/${s.id}`);
  assert.equal(detalle.status, 200);
  assert.equal(detalle.data.solicitud.id, s.id);
  assert.equal(detalle.data.antecedentes.solicitudesActivas[0].id, s.id);
});

test('bloquea un RUT duplicado pese a diferencias de formato y muestra alerta', async () => {
  const payload = body();
  payload.postulante.tipoIdentificacion = 'RUT'; payload.postulante.identificacion = '12.345.678-5';
  assert.equal((await crear(payload)).status, 201);
  payload.postulante.identificacion = ' 12345678-5 ';
  const duplicate = await crear(payload);
  assert.equal(duplicate.status, 409);
  assert.ok(duplicate.data.alertas.some(a => a.codigo === 'SOLICITUD_ACTIVA'));
  const lookup = await request('/antecedentes?identificacion=12.345.678-5');
  assert.equal(lookup.status, 200);
  assert.equal(lookup.data.solicitudesActivas.length, 1);
});

test('reutiliza postulantes de solicitudes cerradas y conserva los datos históricos', async () => {
  const payload = body();
  const primera = await crear(payload);
  await prisma.solicitudAdopcion.update({ where: { id: primera.data.solicitud.id }, data: { estado: 'RECHAZADA' } });
  payload.postulante.email = 'nuevo@example.test';
  const segunda = await crear(payload);
  assert.equal(segunda.status, 201);
  assert.equal(segunda.data.solicitud.postulanteId, primera.data.solicitud.postulanteId);
  const detalle = await request(`/solicitudes/${primera.data.solicitud.id}`);
  assert.equal(detalle.data.solicitud.datosPostulante.email, 'postulante@example.test');
  assert.equal(detalle.data.solicitud.postulante.email, 'nuevo@example.test');
});

test('seis envíos simultáneos generan exactamente una solicitud y un postulante', async () => {
  const payload = body();
  const responses = await Promise.all(Array.from({ length: 6 }, () => crear(payload)));
  assert.equal(responses.filter(r => r.status === 201).length, 1);
  assert.equal(responses.filter(r => r.status === 409).length, 5);
  const postulantes = await prisma.postulante.findMany({ where: { rut: payload.postulante.identificacion } });
  assert.equal(postulantes.length, 1);
  assert.equal(await prisma.solicitudAdopcion.count({ where: { postulanteId: postulantes[0].id } }), 1);
});

test('el índice de PostgreSQL bloquea duplicados fuera de la API', async () => {
  const original = (await crear()).data.solicitud;
  await assert.rejects(prisma.solicitudAdopcion.create({ data: {
    postulanteId: original.postulanteId, animalId: original.animalId, registradoPorId: responsable.id,
    motivacion: 'Intento directo duplicado', datosPostulante: original.datosPostulante, estado: 'APROBADA'
  } }), error => error.code === 'P2002');
});

test('una devolución previa produce alerta sin impedir una nueva solicitud', async () => {
  const animal = await crearAnimal();
  const payload = body(identidad(), animal.id);
  const primera = (await crear(payload)).data.solicitud;
  await prisma.solicitudAdopcion.update({ where: { id: primera.id }, data: { estado: 'ENTREGADA' } });
  const adopcion = await prisma.adopcion.create({ data: { solicitudId: primera.id, animalId: primera.animalId, postulanteId: primera.postulanteId, fecha: new Date('2026-01-01T12:00:00Z'), etapa: 'Adoptado' } });
  await prisma.devolucion.create({ data: { adopcionId: adopcion.id, fecha: new Date('2026-02-01T12:00:00Z'), motivo: 'Cambio de vivienda', estadoAnimal: 'Buen estado general', responsableId: responsable.id } });
  const lookup = await request(`/antecedentes?tipoIdentificacion=OTRO&identificacion=${payload.postulante.identificacion}`);
  assert.equal(lookup.data.devolucionesPrevias.length, 1);
  assert.ok(lookup.data.alertas.some(a => a.codigo === 'DEVOLUCIONES_PREVIAS'));
  const nueva = await crear(payload);
  assert.equal(nueva.status, 201);
  assert.ok(nueva.data.alertas.some(a => a.codigo === 'DEVOLUCIONES_PREVIAS'));
  const duplicate = await crear(payload);
  assert.deepEqual(duplicate.data.alertas.map(a => a.codigo), ['SOLICITUD_ACTIVA', 'DEVOLUCIONES_PREVIAS']);
  assert.equal((await prisma.animal.findUnique({ where: { id: animal.id } })).nota, 'Ficha original intacta');
});

test('excluye animales con adopción vigente y rechaza solicitudes para ellos', async () => {
  const animal = await crearAnimal();
  const anterior = (await crear(body(identidad(), animal.id))).data.solicitud;
  await prisma.solicitudAdopcion.update({ where: { id: anterior.id }, data: { estado: 'ENTREGADA' } });
  await prisma.adopcion.create({ data: { solicitudId: anterior.id, animalId: anterior.animalId, postulanteId: anterior.postulanteId, fecha: new Date(), etapa: 'Adoptado' } });
  assert.equal((await crear(body(identidad(), animal.id))).status, 409);
  const disponibles = await request('/animales-disponibles');
  assert.equal(disponibles.status, 200);
  assert.equal(disponibles.data.some(a => a.id === animal.id), false);
});

test('la validación rechaza entradas inválidas y no permite falsificar al responsable', async () => {
  assert.equal((await crear({ ...body(), registradoPorId: veterinaria.id })).status, 400);
  assert.equal((await crear({ ...body(), estado: 'APROBADA' })).status, 400);
  assert.equal((await crear({ ...body(), motivacion: '  ' })).status, 400);
  assert.equal((await request('/solicitudes/abc')).status, 400);
  assert.equal((await request('/solicitudes/2147483648')).status, 400);
  assert.equal((await request('/solicitudes?limite=1000')).status, 400);
  assert.equal((await request('/antecedentes?identificacion=12.345.678-9')).status, 400);
});

test('un animal inexistente no deja postulantes huérfanos', async () => {
  const payload = body(identidad(), 2147483647);
  assert.equal((await crear(payload)).status, 404);
  assert.equal(await prisma.postulante.count({ where: { rut: payload.postulante.identificacion } }), 0);
  assert.equal((await request('/solicitudes/2147483647')).status, 404);
});

test('consulta paginada y filtros devuelven resultados consistentes', async () => {
  const documento = `${identidad()}-ABC`;
  assert.equal((await crear(body(documento))).status, 201);
  const documentoResult = await request(`/solicitudes?search=${documento.toLowerCase()}`);
  assert.equal(documentoResult.data.total, 1);
  assert.equal(documentoResult.data.solicitudes[0].postulante.identificacion, documento);
  const result = await request(`/solicitudes?search=${run}&estado=RECIBIDA&limite=2&pagina=1`);
  assert.equal(result.status, 200);
  assert.equal(result.data.solicitudes.length, 2);
  assert.ok(result.data.total > 2);
  assert.ok(result.data.solicitudes.every(s => s.estado === 'RECIBIDA'));
  const page2 = await request(`/solicitudes?search=${run}&estado=RECIBIDA&limite=2&pagina=2`);
  assert.equal(page2.data.total, result.data.total);
  assert.equal(page2.data.solicitudes.some(s => result.data.solicitudes.some(first => first.id === s.id)), false);
  const empty = await request('/antecedentes?tipoIdentificacion=OTRO&identificacion=NOEXISTE');
  assert.deepEqual(empty.data, { postulante: null, solicitudesActivas: [], devolucionesPrevias: [], alertas: [] });
});

test('las relaciones impiden borrar un animal con solicitudes e historial', async () => {
  await assert.rejects(prisma.animal.delete({ where: { id: animales[0].id } }), error => error.code === 'P2003');
});

test('reconoce postulantes y devoluciones del modelo anterior sin duplicarlos', async () => {
  const previo = await prisma.postulante.create({ data: { rut: '11.111.111-1', nombre: 'Postulante anterior' } });
  const anterior = await prisma.adopcion.create({ data: { animalId: animales[0].id, postulanteId: previo.id, etapa: 'En revisión' } });
  const payload = body();
  payload.postulante.tipoIdentificacion = 'RUT'; payload.postulante.identificacion = '11111111-1';
  const bloqueada = await crear(payload);
  assert.equal(bloqueada.status, 409);
  assert.ok(bloqueada.data.alertas.some(a => a.codigo === 'SOLICITUD_ACTIVA'));
  await prisma.adopcion.update({ where: { id: anterior.id }, data: { etapa: 'Devuelto', devolucion: true } });
  const nueva = await crear(payload);
  assert.equal(nueva.status, 201);
  assert.equal(nueva.data.solicitud.postulanteId, previo.id);
  assert.equal(nueva.data.solicitud.postulante.rut, '11.111.111-1');
  assert.ok(nueva.data.alertas.some(a => a.codigo === 'DEVOLUCIONES_PREVIAS'));
  const antecedentes = await request('/antecedentes?identificacion=11.111.111-1');
  assert.equal(antecedentes.data.devolucionesPrevias[0].fecha, null);
  await assert.rejects(prisma.postulante.create({ data: { rut: '111111111', nombre: 'Duplicado directo' } }), error => error.code === 'P2002');
});

test('respeta las bajas lógicas de animales y postulantes', async () => {
  const animal = await crearAnimal();
  await prisma.animal.update({ where: { id: animal.id }, data: { activo: false } });
  assert.equal((await crear(body(identidad(), animal.id))).status, 404);
  const documento = identidad();
  await prisma.postulante.create({ data: { rut: documento, tipoIdentificacion: 'OTRO', nombre: 'Inactivo', activo: false } });
  const result = await crear(body(documento));
  assert.equal(result.status, 409);
  assert.ok(result.data.alertas.some(a => a.codigo === 'POSTULANTE_INACTIVO'));
});

test('edita y elimina lógicamente con auditoría, permisos y protección frente a cambios simultáneos', async () => {
  const payload = body();
  const created = await crear(payload);
  assert.equal(created.status, 201);
  const s = created.data.solicitud;
  const ruta = `/solicitudes/${s.id}`;
  const cambios = { ...payload, motivacion: 'Motivación corregida con espacio para paseos diarios.', actualizadoEn: s.actualizadoEn };
  for (const method of ['PATCH', 'DELETE']) {
    assert.equal((await request(ruta, { method, usuario: null, data: cambios })).status, 401);
    assert.equal((await request(ruta, { method, usuario: veterinaria, data: cambios })).status, 403);
  }
  assert.equal((await request(ruta, { method: 'PATCH', data: { ...cambios, postulante: { ...payload.postulante, identificacion: identidad() } } })).status, 400);
  const updated = await request(ruta, { method: 'PATCH', data: cambios });
  assert.equal(updated.status, 200);
  assert.equal(updated.data.solicitud.motivacion, cambios.motivacion);
  assert.equal((await request(ruta, { method: 'PATCH', data: cambios })).status, 409);
  const removed = await request(ruta, { method: 'DELETE', data: { actualizadoEn: updated.data.solicitud.actualizadoEn } });
  assert.equal(removed.status, 200);
  assert.equal(removed.data.solicitud.estado, 'CANCELADA');
  assert.equal((await request(ruta)).status, 200);
  assert.equal((await request(ruta, { method: 'PATCH', data: { ...cambios, actualizadoEn: removed.data.solicitud.actualizadoEn } })).status, 409);
  const audit = await prisma.auditoria.findMany({ where: { entidad: 'SolicitudAdopcion', entidadId: s.id } });
  assert.ok(audit.some(a => a.accion === 'MODIFICACION' && a.valorAnterior.motivacion === payload.motivacion));
  assert.ok(audit.some(a => a.accion === 'BAJA_LOGICA' && a.usuarioId === responsable.id));
  assert.equal((await crear(payload)).status, 201);
});
