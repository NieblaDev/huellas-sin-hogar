import { request } from './api.js';

export const obtenerMatriz = semana => request('/turnos/matriz', { params: semana ? { semana } : undefined });
export const listarTurnos = () => request('/turnos');
export const listarPermutas = () => request('/turnos/permutas');
export const listarDirectorio = () => request('/turnos/directorio');
export const inscribirTurno = (id, json) => request('/turnos/' + id + '/inscribirse', { method: 'POST', json });
export const desinscribirTurno = (id, usuarioId) => request('/turnos/' + id + '/desinscribirse', { method: 'DELETE', params: usuarioId ? { usuarioId } : undefined });
export const gestionarPlanificacion = (limpiar, json) => request(limpiar ? '/turnos/matriz/limpiar' : '/turnos/confirmar-planificacion', { method: 'POST', json });
export const crearTurno = json => request('/turnos', { method: 'POST', json });
export const solicitarPermuta = json => request('/turnos/permutas', { method: 'POST', json });
export const responderPermuta = (id, json) => request('/turnos/permutas/' + id + '/responder', { method: 'PUT', json });
export const registrarBitacora = (id, json) => request('/turnos/' + id + '/bitacora', { method: 'POST', json });
