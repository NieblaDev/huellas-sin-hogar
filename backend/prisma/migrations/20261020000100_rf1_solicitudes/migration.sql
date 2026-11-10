-- CreateEnum
CREATE TYPE "TipoIdentificacion" AS ENUM ('RUT', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoSolicitud" AS ENUM ('RECIBIDA', 'EN_EVALUACION', 'VISITA_AGENDADA', 'VISITA_REALIZADA', 'APROBADA', 'RECHAZADA', 'ENTREGADA', 'CANCELADA');

-- AlterTable
ALTER TABLE "postulantes" ADD COLUMN     "tipoIdentificacion" "TipoIdentificacion" NOT NULL DEFAULT 'RUT';

-- AlterTable
ALTER TABLE "adopciones" ADD COLUMN     "solicitudId" INTEGER;

-- CreateTable
CREATE TABLE "solicitudes_adopcion" (
    "id" SERIAL NOT NULL,
    "postulanteId" INTEGER NOT NULL,
    "animalId" INTEGER NOT NULL,
    "registradoPorId" INTEGER NOT NULL,
    "estado" "EstadoSolicitud" NOT NULL DEFAULT 'RECIBIDA',
    "motivacion" TEXT NOT NULL,
    "datosPostulante" JSONB NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solicitudes_adopcion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devoluciones" (
    "id" SERIAL NOT NULL,
    "adopcionId" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "motivo" TEXT NOT NULL,
    "estadoAnimal" TEXT NOT NULL,
    "responsableId" INTEGER NOT NULL,

    CONSTRAINT "devoluciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "solicitudes_adopcion_estado_creadoEn_idx" ON "solicitudes_adopcion"("estado", "creadoEn");

-- CreateIndex
CREATE INDEX "solicitudes_adopcion_animalId_idx" ON "solicitudes_adopcion"("animalId");

-- CreateIndex
CREATE UNIQUE INDEX "devoluciones_adopcionId_key" ON "devoluciones"("adopcionId");

-- CreateIndex
CREATE UNIQUE INDEX "adopciones_solicitudId_key" ON "adopciones"("solicitudId");

-- AddForeignKey
ALTER TABLE "adopciones" ADD CONSTRAINT "adopciones_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "solicitudes_adopcion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_adopcion" ADD CONSTRAINT "solicitudes_adopcion_postulanteId_fkey" FOREIGN KEY ("postulanteId") REFERENCES "postulantes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_adopcion" ADD CONSTRAINT "solicitudes_adopcion_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "animales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_adopcion" ADD CONSTRAINT "solicitudes_adopcion_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones" ADD CONSTRAINT "devoluciones_adopcionId_fkey" FOREIGN KEY ("adopcionId") REFERENCES "adopciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones" ADD CONSTRAINT "devoluciones_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma 5 no expresa índices parciales ni índices sobre expresiones.
-- Mantener estas restricciones al modificar estados o identificación.
CREATE UNIQUE INDEX "solicitudes_adopcion_postulante_activo_key"
ON "solicitudes_adopcion" ("postulanteId")
WHERE "estado" IN ('RECIBIDA', 'EN_EVALUACION', 'VISITA_AGENDADA', 'VISITA_REALIZADA', 'APROBADA');

-- Mantiene los RUT existentes con su formato, pero impide crear su variante duplicada.
-- Si ya hay identidades duplicadas en los datos anteriores, la migración se detiene
-- para que se revisen explícitamente; no borra ni combina registros automáticamente.
CREATE UNIQUE INDEX "postulantes_identidad_normalizada_key"
ON "postulantes" ("tipoIdentificacion", (CASE WHEN "tipoIdentificacion" = 'RUT'
  THEN regexp_replace(upper(rut), '[.[:space:]-]', '', 'g')
  ELSE regexp_replace(upper(rut), '[[:space:]]', '', 'g') END));
