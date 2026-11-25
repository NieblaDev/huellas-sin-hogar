import { request } from './api.js';

export const listarUsuarios = signal => request('/usuarios', { signal, cache: 'no-store' });
export const crearUsuario = json => request('/usuarios', { method: 'POST', json });
export const actualizarSexo = (email, json) => request('/usuarios/' + encodeURIComponent(email) + '/sexo', { method: 'PATCH', json });
export const eliminarUsuario = email => request('/usuarios/' + encodeURIComponent(email), { method: 'DELETE' });
