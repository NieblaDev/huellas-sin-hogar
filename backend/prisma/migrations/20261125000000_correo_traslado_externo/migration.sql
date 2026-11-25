CREATE TYPE "EstadoCorreoTraslado" AS ENUM ('PENDIENTE', 'ENVIANDO', 'ENVIADO', 'FALLIDO');

ALTER TABLE "traslados"
ADD COLUMN "destinoEmail" VARCHAR(254),
ADD COLUMN "correoEstado" "EstadoCorreoTraslado",
ADD COLUMN "correoIntentos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "correoDisponibleEn" TIMESTAMP(3),
ADD COLUMN "correoEnviadoEn" TIMESTAMP(3);

CREATE INDEX "traslados_correoEstado_correoDisponibleEn_idx" ON "traslados"("correoEstado", "correoDisponibleEn");
