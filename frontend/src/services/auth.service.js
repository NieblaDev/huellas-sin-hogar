import { request } from './api.js';

export const obtenerSesion = (token, signal) => request('/auth/sesion', { token, signal, cache: 'no-store' });
export const iniciarSesion = data => request('/auth/login', { method: 'POST', json: data, token: null });
