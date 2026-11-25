import 'dotenv/config';
import app from './app.js';
import prisma from './config/prisma.js';

const port = Number(process.env.PORT || 80);
const host = process.env.HOST || '0.0.0.0';

try {
  await prisma.$connect();
  const server = app.listen(port, host, () => {
    console.log('Servidor Huellas Sin Hogar corriendo en puerto', port);
  });
  server.on('error', async error => {
    console.error('No se pudo abrir el servidor:', error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });

  const detener = () => server.close(async () => {
    await prisma.$disconnect();
  });
  process.once('SIGINT', detener);
  process.once('SIGTERM', detener);
} catch (error) {
  console.error('No se pudo conectar con PostgreSQL:', error);
  await prisma.$disconnect();
  process.exitCode = 1;
}
