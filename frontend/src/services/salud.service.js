import { request } from './api.js';

export const listarAlertasSalud = () => request('/salud/alertas');
export const obtenerHistorial = id => request('/salud/historial/' + id);
export const registrarVacuna = json => request('/salud/vacunas', { method: 'POST', json });
export const registrarAtencion = json => request('/salud/atenciones', { method: 'POST', json });
