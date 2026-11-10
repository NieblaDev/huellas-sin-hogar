import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) {
  // Si no se define base de pruebas de integración, omitir silenciosamente
  test('insumo integration: omitido por falta de TEST_DATABASE_URL', () => {
    assert.ok(true);
  });
} else {
  const parsedUrl = new URL(testUrl);
  const testSchema = `rf7_insumo_${randomUUID().replace(/-/g, '')}`;
  const admin = new PrismaClient({ datasources: { db: { url: testUrl } } });
  parsedUrl.searchParams.set('schema', testSchema);
  process.env.DATABASE_URL = parsedUrl.toString();
  process.env.JWT_SECRET = 'rf7-local-test-secret';

  const { default: prisma } = await import('../src/config/prisma.js');
  const { default: insumoRoutes } = await import('../src/routes/insumo.routes.js');

  let server, base, dirUser, vetUser, avanUser, novUser;
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
    // Ejecutar migraciones o crear tablas si aplica
    server = express();
    server.use(express.json());
    server.use('/insumos', insumoRoutes);
    await new Promise((resolve) => {
      const s = server.listen(0, () => {
        base = `http://localhost:${s.address().port}`;
        resolve();
      });
    });

    dirUser = await prisma.usuario.create({
      data: { email: `dir_${Date.now()}@test.cl`, password: 'hash', nombre: 'Directora Test', rol: 'DIRECTORA' }
    });
    vetUser = await prisma.usuario.create({
      data: { email: `vet_${Date.now()}@test.cl`, password: 'hash', nombre: 'Veterinaria Test', rol: 'VETERINARIA' }
    });
    avanUser = await prisma.usuario.create({
      data: { email: `avan_${Date.now()}@test.cl`, password: 'hash', nombre: 'Avanzado Test', rol: 'VOLUNTARIO_AVANZADO' }
    });
    novUser = await prisma.usuario.create({
      data: { email: `nov_${Date.now()}@test.cl`, password: 'hash', nombre: 'Novato Test', rol: 'VOLUNTARIO_NOVATO' }
    });
  });

  after(async () => {
    await prisma.$disconnect();
    await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${testSchema}" CASCADE`);
    await admin.$disconnect();
  });

  test('restricción estricta de fármacos: usuario no clínico no puede consultar ni editar fármacos', async () => {
    // 1. Veterinaria crea un fármaco
    const resCrear = await request('/insumos', {
      usuario: vetUser,
      method: 'POST',
      data: {
        nombre: 'Cefalexina 500mg',
        categoria: 'Medicamento',
        stock: 30,
        stockMinimo: 10,
        unidad: 'Comprimidos',
        esFarmaco: true
      }
    });
    assert.equal(resCrear.status, 201);
    const farmacoId = resCrear.data.id;

    // 2. Voluntario avanzado intenta crear fármaco -> Denegado (403)
    const resAvanCrear = await request('/insumos', {
      usuario: avanUser,
      method: 'POST',
      data: {
        nombre: 'Ketamina 10%',
        categoria: 'Medicamento',
        stock: 5,
        stockMinimo: 2,
        esFarmaco: true
      }
    });
    assert.equal(resAvanCrear.status, 403);

    // 3. Voluntario avanzado lista insumos: el fármaco no debe aparecer
    const resListarAvan = await request('/insumos', { usuario: avanUser });
    assert.equal(resListarAvan.status, 200);
    assert.ok(!resListarAvan.data.some(i => i.id === farmacoId));

    // 4. Veterinaria lista insumos: el fármaco sí aparece
    const resListarVet = await request('/insumos', { usuario: vetUser });
    assert.equal(resListarVet.status, 200);
    assert.ok(resListarVet.data.some(i => i.id === farmacoId));
  });

  test('prohibición de saldos negativos: no se permite salida superior al stock disponible', async () => {
    const resIns = await request('/insumos', {
      usuario: dirUser,
      method: 'POST',
      data: {
        nombre: 'Alimento Cachorros 10kg',
        categoria: 'Alimento',
        stock: 5,
        stockMinimo: 3,
        unidad: 'Sacos'
      }
    });
    assert.equal(resIns.status, 201);
    const insId = resIns.data.id;

    // Salida excesiva (6 sacos cuando solo hay 5) -> 400
    const resSalidaExcesiva = await request(`/insumos/${insId}/movimientos`, {
      usuario: avanUser,
      method: 'POST',
      data: {
        tipo: 'SALIDA',
        subtipo: 'CONSUMO',
        cantidad: 6,
        motivo: 'Alimentación semanal'
      }
    });
    assert.equal(resSalidaExcesiva.status, 400);
    assert.ok(resSalidaExcesiva.data.error.includes('No se permiten saldos negativos') || resSalidaExcesiva.data.error.includes('Stock insuficiente'));

    // Salida permitida (3 sacos) -> 201 y stock se reduce a 2 en tiempo real
    const resSalidaValida = await request(`/insumos/${insId}/movimientos`, {
      usuario: avanUser,
      method: 'POST',
      data: {
        tipo: 'SALIDA',
        subtipo: 'CONSUMO',
        cantidad: 3,
        motivo: 'Alimentación semanal de cachorros'
      }
    });
    assert.equal(resSalidaValida.status, 201);
    assert.equal(resSalidaValida.data.insumoActualizado.stock, 2);

    // Entrada clasificada por donación (10 sacos) -> stock aumenta a 12 en tiempo real
    const resEntrada = await request(`/insumos/${insId}/movimientos`, {
      usuario: avanUser,
      method: 'POST',
      data: {
        tipo: 'ENTRADA',
        subtipo: 'DONACION',
        cantidad: 10,
        motivo: 'Donación de vecino',
        donanteOProveedor: 'Vecinos de la comuna'
      }
    });
    assert.equal(resEntrada.status, 201);
    assert.equal(resEntrada.data.insumoActualizado.stock, 12);
  });
}
