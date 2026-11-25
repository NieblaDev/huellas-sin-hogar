# Backend Huellas Sin Hogar - Express + Prisma
FROM node:20-bookworm-slim

WORKDIR /app

# Dependencias del sistema necesarias para Prisma (openssl) y wait de red
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

# Instalar dependencias (incluye Prisma CLI para migraciones)
COPY package*.json ./
RUN npm ci

# Generar el cliente de Prisma con el schema real
COPY prisma ./prisma
RUN npx prisma generate

# Copiar el resto del código
COPY . .

RUN chmod +x ./docker-entrypoint.sh

ENV NODE_ENV=production
EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
