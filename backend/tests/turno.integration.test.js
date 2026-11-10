import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) {
  test('turno integration: omitido por falta de TEST_DATABASE_URL', () => {
    assert.ok(true);
  });
} else {
  const parsedUrl = new URL(testUrl);
  const testSchema = `rf6_turno_${randomUUID().replace(/-/g, '')}`;
  const admin = new PrismaClient({ datasources: { db: { url: testUrl } } });
  parsedUrl.searchParams.set('schema', testSchema);
  process.env.DATABASE_URL = parsedUrl.toString();
  process.env.JWT_SECRET = 'rf6-local-test-secret';

  const { default: prisma } = await import('../src/config/prisma.js');
  const { default: turnoRoutes } = await import('../src/routes/turno.routes.js');

  let server, base, coordUser, avanUser, novUser1, novUser2;
  const token = (u) => jwt.sign({ id: u.id, email: u.email, rol: u.rol, nombre: u.nombre }, process.env.JWT_SECRET, { expiresIn: '15m' });

  const request = async (path, { usuario, method = 'GET', data } = {}) => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(usuario && { Authorization: `Bearer ${token(usuario)}` })
      },
      ...(data && { body: JSON.stringify(data) })
    });
    return { status: response.status, data: await response.json() };
  };

  before(async () => {
    await admin.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${testSchema}"`);
    server = express();
    server.use(express.json());
    server.use('/turnos', turnoRoutes);
    await new Promise((resolve) => {
      const s = server.listen(0, () => {
        base = `http://localhost:${s.address().port}`;
        resolve();
      });
    });

    coordUser = await prisma.usuario.create({
      data: { email: `coord_${Date.now()}@test.cl`, password: 'hash', nombre: 'Coordinadora Directora', rol: 'DIRECTORA' }
    });
    avanUser = await prisma.usuario.create({
      data: { email: `avan_t_${Date.now()}@test.cl`, password: 'hash', nombre: 'Voluntario Avanzado', rol: 'VOLUNTARIO_AVANZADO' }
    });
    novUser1 = await prisma.usuario.create({
      data: { email: `nov1_${Date.now()}@test.cl`, password: 'hash', nombre: 'Novato 1', rol: 'VOLUNTARIO_NOVATO' }
    });
    novUser2 = await prisma.usuario.create({
      data: { email: `nov2_${Date.now()}@test.cl`, password: 'hash', nombre: 'Novato 2', rol: 'VOLUNTARIO_NOVATO' }
    });
  });

  after(async () => {
    await prisma.$disconnect();
    await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${testSchema}" CASCADE`);
    await admin.$disconnect();
  });

  test('restricción de tareas críticas: novato no puede inscribirse en tarea crítica', async () => {
    // 1. Coordinador crea turno crítico de Atención Veterinaria
    const resCrear = await request('/turnos', {
      usuario: coordUser,
      method: 'POST',
      data: {
        diaSemana: 'Lunes',
        franja: 'Mañana',
        area: 'Atención Veterinaria',
        esCritica: true,
        cupoMaximo: 1
      }
    });
    assert.equal(resCrear.status, 201);
    const turnoCriticoId = resCrear.data.id;

    // 2. Novato intenta inscribirse -> 403 Prohibido
    const resNovato = await request(`/turnos/${turnoCriticoId}/inscribirse`, {
      usuario: novUser1,
      method: 'POST'
    });
    assert.equal(resNovato.status, 403);
    assert.ok(resNovato.data.error.includes('Personal Avanzado') || resNovato.data.error.includes('CRÍTICA'));

    // 3. Voluntario Avanzado sí puede inscribirse -> 201
    const resAvanzado = await request(`/turnos/${turnoCriticoId}/inscribirse`, {
      usuario: avanUser,
      method: 'POST'
    });
    assert.equal(resAvanzado.status, 201);
  });

  test('reglas de aforo y cruce de horario: sin sobrecupo ni cruces', async () => {
    // 1. Turno de paseos con cupo máximo 1
    const resT1 = await request('/turnos', {
      usuario: coordUser,
      method: 'POST',
      data: {
        diaSemana: 'Martes',
        franja: 'Mañana',
        area: 'Paseos Caninos',
        cupoMaximo: 1
      }
    });
    assert.equal(resT1.status, 201);
    const tPaseosId = resT1.data.id;

    // Novato 1 se inscribe
    const resInsc1 = await request(`/turnos/${tPaseosId}/inscribirse`, { usuario: novUser1, method: 'POST' });
    assert.equal(resInsc1.status, 201);

    // Novato 2 intenta inscribirse en el mismo turno lleno -> 400 Sobrecupo
    const resInsc2 = await request(`/turnos/${tPaseosId}/inscribirse`, { usuario: novUser2, method: 'POST' });
    assert.equal(resInsc2.status, 400);
    assert.ok(resInsc2.data.error.includes('Sobrecupo no permitido'));

    // 2. Turno de limpieza en el MISMO día y MISMA franja (Martes Mañana)
    const resT2 = await request('/turnos', {
      usuario: coordUser,
      method: 'POST',
      data: {
        diaSemana: 'Martes',
        franja: 'Mañana',
        area: 'Limpieza Patios',
        cupoMaximo: 2
      }
    });
    assert.equal(resT2.status, 201);
    const tLimpiezaId = resT2.data.id;

    // Novato 1 intenta inscribirse en Limpieza (cruce de horario) -> 400 Cruce
    const resCruce = await request(`/turnos/${tLimpiezaId}/inscribirse`, { usuario: novUser1, method: 'POST' });
    assert.equal(resCruce.status, 400);
    assert.ok(resCruce.data.error.includes('cruce de horarios'));
  });

  test('permutas validadas por ambas partes: intercambio atómico tras aprobación del destinatario', async () => {
    // Turno Miércoles Mañana para Novato 1
    const resMiercoles = await request('/turnos', {
      usuario: coordUser,
      method: 'POST',
      data: { diaSemana: 'Miércoles', franja: 'Mañana', area: 'Alimentación', cupoMaximo: 2 }
    });
    const tMiercolesId = resMiercoles.data.id;
    await request(`/turnos/${tMiercolesId}/inscribirse`, { usuario: novUser1, method: 'POST' });

    // Turno Jueves Mañana para Novato 2
    const resJueves = await request('/turnos', {
      usuario: coordUser,
      method: 'POST',
      data: { diaSemana: 'Jueves', franja: 'Mañana', area: 'Paseos', cupoMaximo: 2 }
    });
    const tJuevesId = resJueves.data.id;
    await request(`/turnos/${tJuevesId}/inscribirse`, { usuario: novUser2, method: 'POST' });

    // Novato 1 solicita permuta a Novato 2
    const resPermuta = await request('/turnos/permutas', {
      usuario: novUser1,
      method: 'POST',
      data: {
        turnoOrigenId: tMiercolesId,
        destinatarioId: novUser2.id,
        turnoDestinoId: tJuevesId,
        motivo: 'Cita con el médico el día miércoles'
      }
    });
    assert.equal(resPermuta.status, 201);
    const permutaId = resPermuta.data.id;

    // Novato 2 APRUEBA la permuta
    const resAprobar = await request(`/turnos/permutas/${permutaId}/responder`, {
      usuario: novUser2,
      method: 'PUT',
      data: { accion: 'APROBAR' }
    });
    assert.equal(resAprobar.status, 200);
    assert.equal(resAprobar.data.estado, 'APROBADA');

    // Verificar que los turnos fueron intercambiados: Novato 2 ahora está en Miércoles y Novato 1 en Jueves
    const turnosDb = await request('/turnos', { usuario: coordUser });
    const turnoM = turnosDb.data.find(t => t.id === tMiercolesId);
    const turnoJ = turnosDb.data.find(t => t.id === tJuevesId);

    assert.ok(turnoM.inscripciones.some(i => i.usuarioId === novUser2.id));
    assert.ok(turnoJ.inscripciones.some(i => i.usuarioId === novUser1.id));
  });

  test('bitácora de turnos: exige inscripción previa obligatoria', async () => {
    const resTurno = await request('/turnos', {
      usuario: coordUser,
      method: 'POST',
      data: { diaSemana: 'Viernes', franja: 'Tarde', area: 'Recepción', cupoMaximo: 2 }
    });
    const tViernesId = resTurno.data.id;

    // Novato 1 intenta registrar bitácora sin estar inscrito -> 403 Bloqueado
    const resSinInscripcion = await request(`/turnos/${tViernesId}/bitacora`, {
      usuario: novUser1,
      method: 'POST',
      data: { tareasRealizadas: 'Atención a visitantes y registro de donaciones' }
    });
    assert.equal(resSinInscripcion.status, 403);
    assert.ok(resSinInscripcion.data.error.includes('inscripción previa obligatoria'));

    // Se inscribe previamente
    await request(`/turnos/${tViernesId}/inscribirse`, { usuario: novUser1, method: 'POST' });

    // Ahora sí puede registrar bitácora -> 201
    const resConInscripcion = await request(`/turnos/${tViernesId}/bitacora`, {
      usuario: novUser1,
      method: 'POST',
      data: { tareasRealizadas: 'Atención a visitantes y registro de donaciones' }
    });
    assert.equal(resConInscripcion.status, 201);
    assert.equal(resConInscripcion.data.tareasRealizadas, 'Atención a visitantes y registro de donaciones');
  });
}
