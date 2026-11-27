import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const prismaCli = createRequire(import.meta.url).resolve('prisma');
const schemaPath = fileURLToPath(new URL('../../prisma/schema.prisma', import.meta.url));

// Sincroniza el esquema de la base de pruebas con schema.prisma sin usar migraciones.
export function pushSchema() {
  execFileSync(
    process.execPath,
    [prismaCli, 'db', 'push', '--schema', schemaPath, '--skip-generate', '--accept-data-loss'],
    { env: { ...process.env, CHECKPOINT_DISABLE: '1' }, stdio: 'pipe' }
  );
}
