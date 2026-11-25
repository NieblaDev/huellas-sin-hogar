import { request } from './api.js';

export const listarTareas = () => request('/cuidados/tareas');
export const obtenerCuidados = id => request('/cuidados/animal/' + id);
export const crearIndicacion = json => request('/cuidados/indicaciones', { method: 'POST', json });
export const completarTarea = json => request('/cuidados/completar', { method: 'POST', json });
