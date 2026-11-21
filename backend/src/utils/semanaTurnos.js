const calendarioChile = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit'
});

export const diasTurnos = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export function sumarDias(fecha, dias) {
  const resultado = new Date(fecha);
  resultado.setUTCDate(resultado.getUTCDate() + dias);
  return resultado;
}

export function obtenerSemanaTurnos(fecha = calendarioChile.format(new Date())) {
  const dia = typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha)
    ? new Date(fecha + 'T00:00:00.000Z') : new Date(NaN);
  if (!Number.isFinite(dia.getTime()) || dia.toISOString().slice(0, 10) !== fecha) {
    throw Object.assign(new Error('Selecciona una fecha válida para la semana.'), { statusCode: 400 });
  }
  const inicio = sumarDias(dia, -((dia.getUTCDay() + 6) % 7));
  const fin = sumarDias(inicio, 7);
  const fechas = diasTurnos.map((_, indice) => sumarDias(inicio, indice).toISOString().slice(0, 10));
  return { inicio, fin, fechas };
}

export function filtroSemanaTurnos(fecha) {
  const { inicio, fin } = obtenerSemanaTurnos(fecha);
  return { gte: inicio, lt: fin };
}
