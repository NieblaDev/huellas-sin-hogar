CREATE TABLE "lecturas_notificaciones" (
  "usuarioId" INTEGER NOT NULL REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "clave" VARCHAR(100) NOT NULL,
  PRIMARY KEY ("usuarioId", "clave")
);
