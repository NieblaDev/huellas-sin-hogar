-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('DIRECTORA', 'VETERINARIA', 'ENCARGADA_ADOPCIONES', 'VOLUNTARIO_AVANZADO', 'VOLUNTARIO_NOVATO');

-- CreateEnum
CREATE TYPE "EstadoSalud" AS ENUM ('NORMAL', 'CONDICION_ESPECIAL', 'CRITICO');

-- CreateEnum
CREATE TYPE "EstadoCanil" AS ENUM ('LIBRE', 'OCUPADO', 'CUARENTENA', 'MANTENIMIENTO');

-- CreateEnum
CREATE TYPE "TipoTraslado" AS ENUM ('INTERNO_CANIL', 'PROTECTORA_ALIADA', 'HOGAR_TEMPORAL');

-- CreateEnum
CREATE TYPE "EstadoTraslado" AS ENUM ('PENDIENTE_APROBACION', 'APROBADO', 'RECHAZADO', 'COMPLETADO');

-- CreateEnum
CREATE TYPE "AccionAuditoria" AS ENUM ('CREACION', 'MODIFICACION', 'BAJA_LOGICA');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(120) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'VOLUNTARIO_NOVATO',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "animales" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "especie" VARCHAR(40) NOT NULL,
    "sexo" VARCHAR(20) NOT NULL,
    "edad" VARCHAR(50) NOT NULL,
    "raza" VARCHAR(80) DEFAULT 'Mestizo',
    "peso" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "chip" VARCHAR(50),
    "estadoSalud" "EstadoSalud" NOT NULL DEFAULT 'NORMAL',
    "nota" TEXT,
    "fotoUrl" TEXT,
    "esterilizacion" VARCHAR(50) DEFAULT 'NO',
    "comportamiento" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPorId" INTEGER,
    "canilId" INTEGER,

    CONSTRAINT "animales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "caniles" (
    "id" SERIAL NOT NULL,
    "codigo" VARCHAR(30) NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "sector" VARCHAR(60) NOT NULL DEFAULT 'General',
    "tipo" VARCHAR(40) NOT NULL DEFAULT 'Perro',
    "capacidad" INTEGER NOT NULL DEFAULT 1,
    "estado" "EstadoCanil" NOT NULL DEFAULT 'LIBRE',

    CONSTRAINT "caniles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "traslados" (
    "id" SERIAL NOT NULL,
    "animalId" INTEGER NOT NULL,
    "tipo" "TipoTraslado" NOT NULL,
    "motivo" TEXT NOT NULL,
    "estado" "EstadoTraslado" NOT NULL DEFAULT 'PENDIENTE_APROBACION',
    "canilOrigenId" INTEGER,
    "canilDestinoId" INTEGER,
    "destinoNombre" VARCHAR(120),
    "destinoContacto" VARCHAR(120),
    "destinoDireccion" VARCHAR(200),
    "responsableId" INTEGER NOT NULL,
    "aprobadoPorId" INTEGER,
    "fechaAprobacion" TIMESTAMP(3),
    "comentarioAprobacion" TEXT,
    "fechaRegistro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "traslados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "postulantes" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "rut" VARCHAR(20) NOT NULL,
    "telefono" VARCHAR(40),
    "email" VARCHAR(120),
    "direccion" VARCHAR(200),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "postulantes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adopciones" (
    "id" SERIAL NOT NULL,
    "animalId" INTEGER NOT NULL,
    "postulanteId" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "etapa" VARCHAR(60) NOT NULL DEFAULT 'Solicitud recibida',
    "devolucion" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "adopciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insumos" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "categoria" VARCHAR(60) NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "stockMinimo" INTEGER NOT NULL DEFAULT 5,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "insumos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turnos" (
    "id" SERIAL NOT NULL,
    "diaSemana" VARCHAR(20) NOT NULL,
    "franja" VARCHAR(20) NOT NULL,
    "area" VARCHAR(60) NOT NULL,
    "voluntario" VARCHAR(100),
    "cubierto" BOOLEAN NOT NULL DEFAULT false,
    "fecha" TIMESTAMP(3),

    CONSTRAINT "turnos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditorias" (
    "id" SERIAL NOT NULL,
    "entidad" VARCHAR(60) NOT NULL,
    "entidadId" INTEGER,
    "accion" "AccionAuditoria" NOT NULL,
    "valorAnterior" JSONB,
    "valorNuevo" JSONB,
    "usuarioId" INTEGER,
    "usuarioEmail" VARCHAR(120),
    "usuarioNombre" VARCHAR(100),
    "fechaHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" VARCHAR(50),

    CONSTRAINT "auditorias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "animales_chip_key" ON "animales"("chip");

-- CreateIndex
CREATE UNIQUE INDEX "animales_canilId_key" ON "animales"("canilId");

-- CreateIndex
CREATE UNIQUE INDEX "caniles_codigo_key" ON "caniles"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "postulantes_rut_key" ON "postulantes"("rut");

-- AddForeignKey
ALTER TABLE "animales" ADD CONSTRAINT "animales_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animales" ADD CONSTRAINT "animales_canilId_fkey" FOREIGN KEY ("canilId") REFERENCES "caniles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traslados" ADD CONSTRAINT "traslados_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "animales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traslados" ADD CONSTRAINT "traslados_canilOrigenId_fkey" FOREIGN KEY ("canilOrigenId") REFERENCES "caniles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traslados" ADD CONSTRAINT "traslados_canilDestinoId_fkey" FOREIGN KEY ("canilDestinoId") REFERENCES "caniles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traslados" ADD CONSTRAINT "traslados_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traslados" ADD CONSTRAINT "traslados_aprobadoPorId_fkey" FOREIGN KEY ("aprobadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adopciones" ADD CONSTRAINT "adopciones_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "animales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adopciones" ADD CONSTRAINT "adopciones_postulanteId_fkey" FOREIGN KEY ("postulanteId") REFERENCES "postulantes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditorias" ADD CONSTRAINT "auditorias_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
