import { request } from './api.js';

export const listarAuditorias = (params, signal) => request('/auditoria', { params, signal });
