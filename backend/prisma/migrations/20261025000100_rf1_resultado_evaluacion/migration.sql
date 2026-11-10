-- Los registros anteriores mantienen su resultado desconocido; no se presume aprobación.
ALTER TABLE "etapas_solicitud_adopcion" ADD COLUMN "resultadoEvaluacion" VARCHAR(30);
ALTER TABLE "etapas_solicitud_adopcion" ADD CONSTRAINT "etapa_resultado_evaluacion_check"
CHECK ("resultadoEvaluacion" IS NULL OR ("accion" = 'EVALUAR' AND "resultadoEvaluacion" IN ('CUMPLE', 'NO_CUMPLE', 'PENDIENTE')));
