CREATE TYPE "EstadoAdopcion" AS ENUM ('EN_REFUGIO', 'ADOPTADO');
ALTER TABLE "animales" ADD COLUMN "estadoAdopcion" "EstadoAdopcion" NOT NULL DEFAULT 'EN_REFUGIO';
ALTER TABLE "adopciones" ADD COLUMN "responsableId" INTEGER;
ALTER TABLE "adopciones" ADD CONSTRAINT "adopciones_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "solicitudes_adopcion" ADD COLUMN "visitaOmitida" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "motivoOmisionVisita" TEXT;
ALTER TABLE "solicitudes_adopcion" ADD CONSTRAINT "solicitud_motivo_omision_check" CHECK (NOT "visitaOmitida" OR length(trim("motivoOmisionVisita")) > 0 AND "motivoOmisionVisita" IS NOT NULL);
CREATE TABLE "etapas_solicitud_adopcion" (
  "id" SERIAL PRIMARY KEY,
  "solicitudId" INTEGER NOT NULL REFERENCES "solicitudes_adopcion"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "accion" VARCHAR(40) NOT NULL,
  "estadoAnterior" "EstadoSolicitud" NOT NULL,
  "estadoNuevo" "EstadoSolicitud" NOT NULL,
  "fecha" TIMESTAMP(3) NOT NULL,
  "observaciones" TEXT NOT NULL,
  "motivoOmision" TEXT,
  "responsableId" INTEGER NOT NULL REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "registradoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "etapas_solicitud_adopcion_solicitudId_registradoEn_idx" ON "etapas_solicitud_adopcion"("solicitudId", "registradoEn");
-- Reconocer adopciones anteriores sin inventar fechas ni responsables históricos.
UPDATE "animales" SET "estadoAdopcion" = 'ADOPTADO'
WHERE EXISTS (SELECT 1 FROM "adopciones" a WHERE a."animalId" = "animales"."id" AND NOT a."devolucion"
  AND a."etapa" IN ('Adoptado', 'Entregada', 'Seguimiento 15d', 'Seguimiento 30d')
  AND NOT EXISTS (SELECT 1 FROM "devoluciones" d WHERE d."adopcionId" = a."id"));
