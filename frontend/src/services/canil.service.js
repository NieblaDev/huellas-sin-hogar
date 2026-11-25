import { request } from './api.js';

export const listarCaniles = () => request('/caniles');
export const listarTraslados = () => request('/caniles/traslados');
export const asignarCanil = json => request('/caniles/asignar', { method: 'POST', json });
export const actualizarSector = (id, json) => request('/caniles/' + id + '/sector', { method: 'PUT', json });
export const solicitarTraslado = json => request('/caniles/traslados', { method: 'POST', json });
export const crearCanil = json => request('/caniles', { method: 'POST', json });
export const eliminarCanil = id => request('/caniles/' + id, { method: 'DELETE' });
export const resolverTraslado = (id, json) => request('/caniles/traslados/' + id + '/aprobacion', { method: 'PUT', json });
