import { copyFileSync, cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const prismaCli = createRequire(import.meta.url).resolve('prisma');
const prismaDir = fileURLToPath(new URL('./', import.meta.url));
const migrationsDir = join(prismaDir, 'migrations');
const inventario = '20261110000200_rf6_rf7_voluntarios_inventario';
const salud = '20261110200529_rf2_salud_cuidados';

const deploy = schema => execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy', '--schema', schema], {
  stdio: 'inherit'
});

// Inventario referencia tratamientos, creados por Salud. El primer pase conserva
// los nombres y checksums históricos de Prisma y aplica las dependencias primero.
const preparacion = mkdtempSync(join(tmpdir(), 'huellas-prisma-'));
try {
  const migracionesPrevias = join(preparacion, 'migrations');
  mkdirSync(migracionesPrevias);
  copyFileSync(join(prismaDir, 'schema.prisma'), join(preparacion, 'schema.prisma'));
  copyFileSync(join(migrationsDir, 'migration_lock.toml'), join(migracionesPrevias, 'migration_lock.toml'));
  for (const entry of readdirSync(migrationsDir, { withFileTypes: true })) {
    if (entry.isDirectory() && (entry.name < inventario || entry.name === salud)) {
      cpSync(join(migrationsDir, entry.name), join(migracionesPrevias, entry.name), { recursive: true });
    }
  }
  deploy(join(preparacion, 'schema.prisma'));
  deploy(join(prismaDir, 'schema.prisma'));
} finally {
  rmSync(preparacion, { recursive: true, force: true });
}
