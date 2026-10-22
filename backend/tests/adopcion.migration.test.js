import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

test('incorpora RF1 a una base existente sin perder usuarios ni fichas', async () => {
  const url = new URL(process.env.TEST_DATABASE_URL || 'postgresql://invalid/invalid');
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && url.pathname.includes('test'), 'Se requiere TEST_DATABASE_URL local de pruebas');
  const schema = `rf1_baseline_${Date.now()}`;
  const admin = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  url.searchParams.set('schema', schema);
  const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  const prismaCli = fileURLToPath(new URL('../node_modules/prisma/build/index.js', import.meta.url));
  const schemaPath = fileURLToPath(new URL('../prisma/schema.prisma', import.meta.url));
  const baselinePath = fileURLToPath(new URL('../prisma/migrations/20261020000000_baseline_pern/migration.sql', import.meta.url));
  const env = { ...process.env, DATABASE_URL: url.toString(), CHECKPOINT_DISABLE: '1' };
  const pgUrl = new URL(url); pgUrl.searchParams.delete('schema');
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  try {
    execFileSync('psql', [pgUrl.toString(), '-v', 'ON_ERROR_STOP=1', '-f', baselinePath], { env: { ...env, PGOPTIONS: `-c search_path=${schema}` }, stdio: 'pipe' });
    const usuario = await db.usuario.create({ data: { email: 'baseline@example.test', nombre: 'Staff existente', password: 'test', rol: 'DIRECTORA' } });
    const animal = await db.animal.create({ data: { nombre: 'Ficha anterior', especie: 'Gato', sexo: 'Hembra', edad: '4 años', chip: 'CHIP-ORIGINAL', nota: 'Historial previo', creadoPorId: usuario.id } });
    const [postulante] = await db.$queryRaw`INSERT INTO postulantes (nombre, rut) VALUES ('Postulante previo', '11.111.111-1') RETURNING id`;
    await db.$executeRaw`INSERT INTO adopciones ("animalId", "postulanteId", etapa, devolucion) VALUES (${animal.id}, ${postulante.id}, 'Devuelto', true)`;
    execFileSync(process.execPath, [prismaCli, 'migrate', 'resolve', '--applied', '20261020000000_baseline_pern', '--schema', schemaPath], { env, stdio: 'pipe' });
    execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy', '--schema', schemaPath], { env, stdio: 'pipe' });
    assert.deepEqual(await db.animal.findUnique({ where: { id: animal.id } }), animal);
    assert.deepEqual(await db.usuario.findUnique({ where: { id: usuario.id } }), usuario);
    assert.equal(await db.solicitudAdopcion.count(), 0);
    const previos = await db.postulante.findMany();
    assert.equal(previos[0].rut, '11.111.111-1');
    assert.equal(previos[0].tipoIdentificacion, 'RUT');
    assert.equal((await db.adopcion.findFirst()).devolucion, true);
    const indexes = await db.$queryRaw`SELECT indexname FROM pg_indexes WHERE schemaname = ${schema} AND indexname = 'solicitudes_adopcion_postulante_activo_key'`;
    assert.equal(indexes.length, 1);
  } finally {
    await db.$disconnect();
    await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    await admin.$disconnect();
  }
});
