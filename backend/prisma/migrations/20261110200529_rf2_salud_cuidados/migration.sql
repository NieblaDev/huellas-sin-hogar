-- CreateEnum
CREATE TYPE "ContextoCuidado" AS ENUM ('EVALUACION_CLINICA', 'CIRUGIA', 'INGRESO_REFUGIO');

-- CreateEnum
CREATE TYPE "CategoriaCuidado" AS ENUM ('DIETA_ESPECIAL', 'MEDICACION_ORAL', 'RESTRICCION_FISICA', 'HIGIENE_CURACION', 'OBSERVACION_CONDUCTA');

-- CreateEnum
CREATE TYPE "NivelCriticidad" AS ENUM ('CRITICA', 'ALTA', 'MEDIA', 'BAJA');

-- CreateEnum
CREATE TYPE "TipoProcedimiento" AS ENUM ('ESTERILIZACION', 'CIRUGIA_GENERAL', 'DESPARASITACION_INTERNA', 'DESPARASITACION_EXTERNA', 'LIMPIEZA_DENTAL', 'CURACION', 'REVISION_GENERAL');

-- CreateEnum
CREATE TYPE "EstadoCuarentena" AS ENUM ('ACTIVA', 'FINALIZADA', 'INTERRUMPIDA');

-- AlterTable
ALTER TABLE "configuraciones_sistema" ALTER COLUMN "actualizadoEn" DROP DEFAULT;

-- AlterTable
ALTER TABLE "seguimientos_adopcion" ALTER COLUMN "actualizadoEn" DROP DEFAULT;

-- CreateTable
CREATE TABLE "indicaciones_cuidado" (
    "id" SERIAL NOT NULL,
    "animalId" INTEGER NOT NULL,
    "contexto" "ContextoCuidado" NOT NULL DEFAULT 'EVALUACION_CLINICA',
    "categoria" "CategoriaCuidado" NOT NULL,
    "criticidad" "NivelCriticidad" NOT NULL DEFAULT 'MEDIA',
    "titulo" VARCHAR(120) NOT NULL,
    "instruccion" TEXT NOT NULL,
    "franjaHoraria" VARCHAR(20) NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "publicadaTurno" BOOLEAN NOT NULL DEFAULT true,
    "creadoPorId" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "indicaciones_cuidado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bitacoras_cuidado" (
    "id" SERIAL NOT NULL,
    "indicacionId" INTEGER NOT NULL,
    "voluntarioId" INTEGER NOT NULL,
    "turnoId" INTEGER,
    "fechaHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observaciones" TEXT,
    "atencionEstado" VARCHAR(40) NOT NULL DEFAULT 'COMPLETADO',

    CONSTRAINT "bitacoras_cuidado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vacunas_animales" (
    "id" SERIAL NOT NULL,
    "animalId" INTEGER NOT NULL,
    "nombreVacuna" VARCHAR(100) NOT NULL,
    "dosis" VARCHAR(50) NOT NULL,
    "lote" VARCHAR(60),
    "fechaAplicacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaVencimiento" TIMESTAMP(3) NOT NULL,
    "veterinariaId" INTEGER NOT NULL,
    "observaciones" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "vacunas_animales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atenciones_clinicas" (
    "id" SERIAL NOT NULL,
    "animalId" INTEGER NOT NULL,
    "veterinariaId" INTEGER NOT NULL,
    "motivo" VARCHAR(150) NOT NULL,
    "diagnostico" TEXT NOT NULL,
    "temperatura" DOUBLE PRECISION,
    "pesoActual" DOUBLE PRECISION,
    "fechaAtencion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atenciones_clinicas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tratamientos_animales" (
    "id" SERIAL NOT NULL,
    "animalId" INTEGER NOT NULL,
    "atencionClinicaId" INTEGER,
    "medicamento" VARCHAR(100) NOT NULL,
    "dosis" VARCHAR(80) NOT NULL,
    "frecuenciaHoras" INTEGER NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "indicacionesExtra" TEXT,

    CONSTRAINT "tratamientos_animales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procedimientos_animales" (
    "id" SERIAL NOT NULL,
    "animalId" INTEGER NOT NULL,
    "atencionClinicaId" INTEGER,
    "tipo" "TipoProcedimiento" NOT NULL,
    "descripcion" TEXT NOT NULL,
    "resultado" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "procedimientos_animales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuarentenas_animales" (
    "id" SERIAL NOT NULL,
    "animalId" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "canilAislamiento" VARCHAR(50),
    "fechaInicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaFinEstimada" TIMESTAMP(3) NOT NULL,
    "fechaFinReal" TIMESTAMP(3),
    "estado" "EstadoCuarentena" NOT NULL DEFAULT 'ACTIVA',
    "observaciones" TEXT,

    CONSTRAINT "cuarentenas_animales_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "indicaciones_cuidado" ADD CONSTRAINT "indicaciones_cuidado_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "animales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicaciones_cuidado" ADD CONSTRAINT "indicaciones_cuidado_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bitacoras_cuidado" ADD CONSTRAINT "bitacoras_cuidado_indicacionId_fkey" FOREIGN KEY ("indicacionId") REFERENCES "indicaciones_cuidado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bitacoras_cuidado" ADD CONSTRAINT "bitacoras_cuidado_voluntarioId_fkey" FOREIGN KEY ("voluntarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vacunas_animales" ADD CONSTRAINT "vacunas_animales_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "animales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atenciones_clinicas" ADD CONSTRAINT "atenciones_clinicas_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "animales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atenciones_clinicas" ADD CONSTRAINT "atenciones_clinicas_veterinariaId_fkey" FOREIGN KEY ("veterinariaId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tratamientos_animales" ADD CONSTRAINT "tratamientos_animales_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "animales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tratamientos_animales" ADD CONSTRAINT "tratamientos_animales_atencionClinicaId_fkey" FOREIGN KEY ("atencionClinicaId") REFERENCES "atenciones_clinicas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procedimientos_animales" ADD CONSTRAINT "procedimientos_animales_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "animales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procedimientos_animales" ADD CONSTRAINT "procedimientos_animales_atencionClinicaId_fkey" FOREIGN KEY ("atencionClinicaId") REFERENCES "atenciones_clinicas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuarentenas_animales" ADD CONSTRAINT "cuarentenas_animales_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "animales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
