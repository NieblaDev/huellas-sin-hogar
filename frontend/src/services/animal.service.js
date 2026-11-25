import { request } from './api.js';

export const listarAnimales = (params, signal) => request('/animals', { params, signal });
export const listarNotificaciones = limit => request('/animals/notificaciones', { params: { limit } });
export const obtenerAnimal = id => request('/animals/' + id);
export const exportarFicha = (id, formato) => request('/animals/' + id + '/export-pdf', { params: { formato } });
export const exportarConsolidado = params => request('/animals/reportes/export-csv', { params });
export const eliminarAnimal = id => request('/animals/' + id, { method: 'DELETE' });
export const guardarAnimal = (id, body) => request(id ? '/animals/' + id : '/animals', { method: id ? 'PUT' : 'POST', body });
