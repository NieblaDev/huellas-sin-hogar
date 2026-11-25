#!/bin/sh
set -e

echo "Waiting for PostgreSQL..."
until node -e 'const { PrismaClient } = require("@prisma/client"); const p = new PrismaClient(); p.$queryRawUnsafe("SELECT 1").then(async () => { await p.$disconnect(); process.exit(0); }).catch(async () => { await p.$disconnect().catch(() => {}); process.exit(1); });'
do
  sleep 2
done
echo "PostgreSQL is ready."

echo "Applying database migrations..."
npx prisma migrate deploy

if [ "$RUN_SEED" = "true" ]; then
  echo "Running initial seed..."
  node prisma/seed.js || echo "Seed failed or was already applied; continuing."
fi

echo "Starting server on port ${PORT:-3000}..."
exec node index.js
