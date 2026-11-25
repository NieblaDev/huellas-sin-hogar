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
  const migracionesPreviasAInventario = [
    '20261020000100_rf1_solicitudes',
    '20261022000100_rf1_etapas_entrega',
    '20261025000100_rf1_resultado_evaluacion',
    '20261110000100_rf2_seguimientos_devoluciones',
    '20261110200529_rf2_salud_cuidados'
  ];
  const env = { ...process.env, DATABASE_URL: url.toString(), CHECKPOINT_DISABLE: '1' };
  const pgEnv = {
    ...env,
    PGHOST: url.hostname.replace(/^\[|\]$/g, ''),
    PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGOPTIONS: `-c search_path=${schema}`
  };
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  try {
    const ejecutarSql = path => execFileSync('psql', ['-w', '-v', 'ON_ERROR_STOP=1', '-f', path], { env: pgEnv, stdio: 'pipe' });
    const registrarMigracion = id => execFileSync(process.execPath, [prismaCli, 'migrate', 'resolve', '--applied', id, '--schema', schemaPath], { env, stdio: 'pipe' });
    ejecutarSql(baselinePath);
    await db.$executeRaw`ALTER TYPE "Rol" ADD VALUE 'COORDINADOR'`;
    const [usuario] = await db.$queryRaw`INSERT INTO usuarios (email, nombre, password, rol) VALUES ('baseline@example.test', 'Staff existente', 'test', 'DIRECTORA') RETURNING id, email, nombre, password, rol::text, activo, "createdAt"`;
    await db.$executeRaw`INSERT INTO usuarios (email, nombre, password, rol) VALUES
      ('clinica@example.test', 'Clínica', 'test', 'VETERINARIA'),
      ('adopciones@example.test', 'Adopciones', 'test', 'ENCARGADA_ADOPCIONES'),
      ('turnos@example.test', 'Planificación', 'test', 'COORDINADOR')`;
    const [animal] = await db.$queryRaw`INSERT INTO animales (nombre, especie, sexo, edad, chip, nota, "creadoPorId") VALUES ('Ficha anterior', 'Gato', 'Hembra', '4 años', 'CHIP-ORIGINAL', 'Historial previo', ${usuario.id}) RETURNING *`;
    const [postulante] = await db.$queryRaw`INSERT INTO postulantes (nombre, rut) VALUES ('Postulante previo', '11.111.111-1') RETURNING id`;
    await db.$executeRaw`INSERT INTO adopciones ("animalId", "postulanteId", etapa, devolucion) VALUES (${animal.id}, ${postulante.id}, 'Devuelto', true)`;
    registrarMigracion('20261020000000_baseline_pern');
    // Inventario referencia tratamientos, que en la base existente se migraron antes.
    for (const id of migracionesPreviasAInventario) {
      ejecutarSql(fileURLToPath(new URL(`../prisma/migrations/${id}/migration.sql`, import.meta.url)));
      registrarMigracion(id);
    }
    execFileSync(process.execPath, [fileURLToPath(new URL('../prisma/migrate.js', import.meta.url))], { env, stdio: 'pipe' });
    assert.deepEqual(await db.animal.findUnique({ where: { id: animal.id } }), { ...animal, fechaIngresoCanil: null, estadoAdopcion: 'EN_REFUGIO' });
    assert.deepEqual(await db.usuario.findUnique({ where: { id: usuario.id } }), { ...usuario, rol: 'DIRECCION', sexo: 'NEUTRO' });
    assert.deepEqual(await db.usuario.findMany({
      where: { id: { not: usuario.id } }, orderBy: { email: 'asc' }, select: { rol: true, sexo: true, activo: true }
    }), [
      { rol: 'PERSONAL_ADOPCIONES', sexo: 'NEUTRO', activo: true },
      { rol: 'PERSONAL_VETERINARIO', sexo: 'NEUTRO', activo: true },
      { rol: 'VOLUNTARIO_NOVATO', sexo: 'NEUTRO', activo: true }
    ]);
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
