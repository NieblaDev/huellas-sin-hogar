import { request } from './api.js';

export const obtenerMetricas = () => request('/dashboard/metrics');
