-- CreateEnum
CREATE TYPE "EstadoSeguimiento" AS ENUM ('PENDIENTE', 'REPROGRAMADO', 'COMPLETADO', 'SIN_CONTACTO');

-- CreateEnum
CREATE TYPE "CanalContacto" AS ENUM ('LLAMADA_TELEFONICA', 'WHATSAPP', 'CORREO_ELECTRONICO', 'VISITA_DOMICILIARIA', 'OTRO');

-- CreateEnum
CREATE TYPE "TipoSeguimiento" AS ENUM ('SEGUIMIENTO_15_DIAS', 'SEGUIMIENTO_30_DIAS', 'EXTRAORDINARIO');

-- AlterTable devoluciones: integrar animal, postulante y detalles de reingreso
ALTER TABLE "devoluciones" ADD COLUMN "animalId" INTEGER;
ALTER TABLE "devoluciones" ADD COLUMN "postulanteId" INTEGER;
ALTER TABLE "devoluciones" ADD COLUMN "observacionesPostulante" TEXT;
ALTER TABLE "devoluciones" ADD COLUMN "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "devoluciones" ALTER COLUMN "fecha" SET DEFAULT CURRENT_TIMESTAMP;

-- Llenar datos desde adopciones para registros existentes si los hubiera
UPDATE "devoluciones" d
SET "animalId" = a."animalId",
    "postulanteId" = a."postulanteId"
FROM "adopciones" a
WHERE d."adopcionId" = a."id";

-- Claves foráneas e índices para consultas directas
ALTER TABLE "devoluciones" ADD CONSTRAINT "devoluciones_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "animales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "devoluciones" ADD CONSTRAINT "devoluciones_postulanteId_fkey" FOREIGN KEY ("postulanteId") REFERENCES "postulantes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "devoluciones_postulanteId_idx" ON "devoluciones"("postulanteId");
CREATE INDEX "devoluciones_animalId_idx" ON "devoluciones"("animalId");

-- CreateTable seguimientos_adopcion
CREATE TABLE "seguimientos_adopcion" (
    "id" SERIAL NOT NULL,
    "adopcionId" INTEGER NOT NULL,
    "tipoSeguimiento" "TipoSeguimiento" NOT NULL DEFAULT 'SEGUIMIENTO_15_DIAS',
    "diasProgramados" INTEGER NOT NULL DEFAULT 15,
    "fechaProgramada" TIMESTAMP(3) NOT NULL,
    "fechaEjecucion" TIMESTAMP(3),
    "canalContacto" "CanalContacto",
    "estadoAnimal" TEXT,
    "resultado" VARCHAR(100),
    "observaciones" TEXT,
    "intentosFallidos" INTEGER NOT NULL DEFAULT 0,
    "limiteIntentos" INTEGER NOT NULL DEFAULT 3,
    "estado" "EstadoSeguimiento" NOT NULL DEFAULT 'PENDIENTE',
    "alertaSinContacto" BOOLEAN NOT NULL DEFAULT false,
    "fechaAlerta" TIMESTAMP(3),
    "responsableId" INTEGER,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seguimientos_adopcion_pkey" PRIMARY KEY ("id")
);

-- CreateTable intentos_seguimiento
CREATE TABLE "intentos_seguimiento" (
    "id" SERIAL NOT NULL,
    "seguimientoId" INTEGER NOT NULL,
    "numeroIntento" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "canalContacto" "CanalContacto" NOT NULL,
    "contactado" BOOLEAN NOT NULL DEFAULT false,
    "resultado" VARCHAR(100),
    "observaciones" TEXT,
    "fechaReprogramada" TIMESTAMP(3),
    "responsableId" INTEGER NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intentos_seguimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable configuraciones_sistema
CREATE TABLE "configuraciones_sistema" (
    "id" SERIAL NOT NULL,
    "clave" VARCHAR(60) NOT NULL,
    "valor" VARCHAR(255) NOT NULL,
    "descripcion" TEXT,
    "actualizadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "configuraciones_sistema_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "seguimientos_adopcion_adopcionId_fechaProgramada_idx" ON "seguimientos_adopcion"("adopcionId", "fechaProgramada");
CREATE INDEX "seguimientos_adopcion_estado_fechaProgramada_idx" ON "seguimientos_adopcion"("estado", "fechaProgramada");
CREATE INDEX "intentos_seguimiento_seguimientoId_fecha_idx" ON "intentos_seguimiento"("seguimientoId", "fecha");
CREATE UNIQUE INDEX "configuraciones_sistema_clave_key" ON "configuraciones_sistema"("clave");

-- AddForeignKey
ALTER TABLE "seguimientos_adopcion" ADD CONSTRAINT "seguimientos_adopcion_adopcionId_fkey" FOREIGN KEY ("adopcionId") REFERENCES "adopciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "seguimientos_adopcion" ADD CONSTRAINT "seguimientos_adopcion_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "intentos_seguimiento" ADD CONSTRAINT "intentos_seguimiento_seguimientoId_fkey" FOREIGN KEY ("seguimientoId") REFERENCES "seguimientos_adopcion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "intentos_seguimiento" ADD CONSTRAINT "intentos_seguimiento_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Insertar configuración inicial del límite de intentos configurables
INSERT INTO "configuraciones_sistema" ("clave", "valor", "descripcion")
VALUES ('SEGUIMIENTO_MAX_INTENTOS', '3', 'Cantidad máxima de intentos fallidos antes de marcar el seguimiento como sin contacto y generar alerta')
ON CONFLICT ("clave") DO NOTHING;

-- Programar seguimientos a 15 y 30 días para adopciones vigentes existentes
INSERT INTO "seguimientos_adopcion" ("adopcionId", "tipoSeguimiento", "diasProgramados", "fechaProgramada", "estado", "limiteIntentos")
SELECT a.id, 'SEGUIMIENTO_15_DIAS', 15, a.fecha + INTERVAL '15 days', 'PENDIENTE', 3
FROM "adopciones" a
WHERE NOT a.devolucion AND a.etapa IN ('Adoptado', 'Entregada')
  AND NOT EXISTS (
    SELECT 1 FROM "seguimientos_adopcion" s WHERE s."adopcionId" = a.id AND s."tipoSeguimiento" = 'SEGUIMIENTO_15_DIAS'
  );

INSERT INTO "seguimientos_adopcion" ("adopcionId", "tipoSeguimiento", "diasProgramados", "fechaProgramada", "estado", "limiteIntentos")
SELECT a.id, 'SEGUIMIENTO_30_DIAS', 30, a.fecha + INTERVAL '30 days', 'PENDIENTE', 3
FROM "adopciones" a
WHERE NOT a.devolucion AND a.etapa IN ('Adoptado', 'Entregada')
  AND NOT EXISTS (
    SELECT 1 FROM "seguimientos_adopcion" s WHERE s."adopcionId" = a.id AND s."tipoSeguimiento" = 'SEGUIMIENTO_30_DIAS'
  );
