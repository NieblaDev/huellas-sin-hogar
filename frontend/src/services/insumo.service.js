import { request } from './api.js';

export const listarInsumos = () => request('/insumos');
export const listarAlertasInventario = () => request('/insumos/alertas');
export const guardarInsumo = (id, json) => request(id ? '/insumos/' + id : '/insumos', { method: id ? 'PUT' : 'POST', json });
export const registrarMovimiento = (id, json) => request('/insumos/' + id + '/movimientos', { method: 'POST', json });
