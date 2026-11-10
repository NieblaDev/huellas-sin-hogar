export const RESULTADOS_EVALUACION = { CUMPLE: 'Cumple', NO_CUMPLE: 'No cumple', PENDIENTE: 'Pendiente de información' };
export const resultadoEvaluacionActual = solicitud => solicitud.etapas?.filter(etapa => etapa.accion === 'EVALUAR').at(-1)?.resultadoEvaluacion || null;
