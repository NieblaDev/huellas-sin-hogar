-- Modificaciones para Requisito 6 (Voluntarios y Turnos) y Requisito 7 (Inventario de Insumos)

-- 1. Enum Rol: Agregar COORDINADOR
ALTER TYPE "Rol" ADD VALUE IF NOT EXISTS 'COORDINADOR';

-- 2. Enums para Inventario
DO $$ BEGIN
  CREATE TYPE "TipoMovimientoInventario" AS ENUM ('ENTRADA', 'SALIDA');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "SubtipoMovimientoInventario" AS ENUM ('DONACION', 'COMPRA', 'CONSUMO', 'TRATAMIENTO_MEDICO', 'MERMA', 'AJUSTE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. Ampliación de tabla insumos
ALTER TABLE "insumos" ADD COLUMN IF NOT EXISTS "unidad" VARCHAR(40) NOT NULL DEFAULT 'Unidades';
ALTER TABLE "insumos" ADD COLUMN IF NOT EXISTS "esFarmaco" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "insumos" ADD COLUMN IF NOT EXISTS "fechaVencimiento" TIMESTAMP(3);
ALTER TABLE "insumos" ADD COLUMN IF NOT EXISTS "lote" VARCHAR(60);
ALTER TABLE "insumos" ADD COLUMN IF NOT EXISTS "ubicacion" VARCHAR(100);
ALTER TABLE "insumos" ADD COLUMN IF NOT EXISTS "actualizadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Marcar como fármacos los medicamentos existentes para cumplir restricción médica
UPDATE "insumos"
SET "esFarmaco" = true
WHERE LOWER("categoria") LIKE '%medicamento%' OR LOWER("categoria") LIKE '%fármaco%' OR LOWER("categoria") LIKE '%farmaco%';

-- 4. Tabla movimientos_inventario
CREATE TABLE IF NOT EXISTS "movimientos_inventario" (
    "id" SERIAL NOT NULL,
    "insumoId" INTEGER NOT NULL,
    "tipo" "TipoMovimientoInventario" NOT NULL,
    "subtipo" "SubtipoMovimientoInventario" NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "stockAnterior" INTEGER NOT NULL,
    "stockNuevo" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "donanteOProveedor" VARCHAR(120),
    "animalId" INTEGER,
    "tratamientoId" INTEGER,
    "lote" VARCHAR(60),
    "fechaVencimiento" TIMESTAMP(3),
    "registradoPorId" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_inventario_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "movimientos_inventario_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "insumos"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "movimientos_inventario_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "animales"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "movimientos_inventario_tratamientoId_fkey" FOREIGN KEY ("tratamientoId") REFERENCES "tratamientos_animales"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "movimientos_inventario_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "movimientos_inventario_insumoId_fecha_idx" ON "movimientos_inventario"("insumoId", "fecha");

-- 5. Ampliación de tabla turnos
ALTER TABLE "turnos" ADD COLUMN IF NOT EXISTS "esCritica" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "turnos" ADD COLUMN IF NOT EXISTS "cupoMaximo" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "turnos" ADD COLUMN IF NOT EXISTS "estadoPlanificacion" VARCHAR(30) NOT NULL DEFAULT 'BORRADOR';
ALTER TABLE "turnos" ADD COLUMN IF NOT EXISTS "horaInicio" VARCHAR(10);
ALTER TABLE "turnos" ADD COLUMN IF NOT EXISTS "horaFin" VARCHAR(10);
ALTER TABLE "turnos" ADD COLUMN IF NOT EXISTS "observaciones" TEXT;

-- 6. Tabla inscripciones_turnos (Gestión individual y prevención de sobrecupos/cruces)
CREATE TABLE IF NOT EXISTS "inscripciones_turnos" (
    "id" SERIAL NOT NULL,
    "turnoId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "estado" VARCHAR(30) NOT NULL DEFAULT 'CONFIRMADA',
    "inscritoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inscritoPorId" INTEGER,
    "asistenciaRegistrada" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "inscripciones_turnos_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "inscripciones_turnos_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "turnos"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "inscripciones_turnos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "inscripciones_turnos_turnoId_usuarioId_idx" ON "inscripciones_turnos"("turnoId", "usuarioId");

-- 7. Tabla permutas_turnos (Permutas validadas por ambas partes)
CREATE TABLE IF NOT EXISTS "permutas_turnos" (
    "id" SERIAL NOT NULL,
    "solicitanteId" INTEGER NOT NULL,
    "destinatarioId" INTEGER NOT NULL,
    "turnoOrigenId" INTEGER NOT NULL,
    "turnoDestinoId" INTEGER,
    "motivo" TEXT NOT NULL,
    "aprobadoSolicitante" BOOLEAN NOT NULL DEFAULT true,
    "aprobadoDestinatario" BOOLEAN NOT NULL DEFAULT false,
    "estado" VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',
    "fechaSolicitud" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaResolucion" TIMESTAMP(3),
    "observacionResolucion" TEXT,

    CONSTRAINT "permutas_turnos_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "permutas_turnos_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "permutas_turnos_destinatarioId_fkey" FOREIGN KEY ("destinatarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "permutas_turnos_turnoOrigenId_fkey" FOREIGN KEY ("turnoOrigenId") REFERENCES "turnos"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "permutas_turnos_turnoDestinoId_fkey" FOREIGN KEY ("turnoDestinoId") REFERENCES "turnos"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "permutas_turnos_solicitanteId_idx" ON "permutas_turnos"("solicitanteId");
CREATE INDEX IF NOT EXISTS "permutas_turnos_destinatarioId_idx" ON "permutas_turnos"("destinatarioId");

-- 8. Tabla bitacoras_turnos (Habilitada tras confirmación e inscripción previa obligatoria)
CREATE TABLE IF NOT EXISTS "bitacoras_turnos" (
    "id" SERIAL NOT NULL,
    "turnoId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "tareasRealizadas" TEXT NOT NULL,
    "incidentes" TEXT,
    "observaciones" TEXT,
    "fechaHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bitacoras_turnos_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "bitacoras_turnos_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "turnos"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "bitacoras_turnos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "bitacoras_turnos_turnoId_usuarioId_idx" ON "bitacoras_turnos"("turnoId", "usuarioId");
