export const DIAS_ESTADIA_PROLONGADA = 30;
export const formatearDiasEnCanil = n => n == null ? '—' : n === 0 ? 'Ingresó hoy' : n === 1 ? '1 día' : n + ' días';
export const diasRestantesCuarentena = (fin, hoy = new Date()) =>
  (Date.parse(new Date(fin).toISOString().slice(0,10)) - Date.parse(hoy.toISOString().slice(0,10))) / 86400000;
