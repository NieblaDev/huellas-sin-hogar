BEGIN;
DROP INDEX "animales_canilId_key";
CREATE INDEX "animales_canilId_idx" ON animales ("canilId");
ALTER TABLE animales ADD COLUMN "fechaIngresoCanil" timestamp(3);
ALTER TABLE caniles ADD COLUMN notas text, ALTER COLUMN tipo SET DEFAULT 'Mixto';
ALTER TABLE cuarentenas_animales ADD COLUMN "canilId" integer REFERENCES caniles(id) ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "cuarentenas_animales_animalId_estado_idx" ON cuarentenas_animales ("animalId", estado);
CREATE INDEX "cuarentenas_animales_canilId_estado_idx" ON cuarentenas_animales ("canilId", estado);
UPDATE caniles c SET tipo = CASE WHEN a.especie IN ('Perro','Gato') THEN a.especie ELSE 'Mixto' END FROM animales a WHERE a."canilId" = c.id;
UPDATE caniles SET tipo = 'Mixto' WHERE tipo NOT IN ('Perro','Gato','Mixto');
UPDATE animales a SET "fechaIngresoCanil" = COALESCE((SELECT max(t."fechaRegistro") FROM traslados t
 WHERE t."animalId" = a.id AND t."canilDestinoId" = a."canilId" AND t.tipo = 'INTERNO_CANIL'), a."creadoEn")
 WHERE a."canilId" IS NOT NULL;
UPDATE cuarentenas_animales q SET "canilId" = a."canilId" FROM animales a WHERE q."animalId" = a.id AND q.estado = 'ACTIVA';
UPDATE caniles c SET estado = 'CUARENTENA' WHERE c.estado <> 'MANTENIMIENTO' AND EXISTS
 (SELECT 1 FROM cuarentenas_animales q WHERE q."canilId" = c.id AND q.estado = 'ACTIVA');
COMMIT;
