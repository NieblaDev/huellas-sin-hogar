import { request } from './api.js';

const solicitar = async (path, options = {}) => {
  const response = await request('/adopciones' + path, { ...options, cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || 'No se pudo completar la operación');
    error.status = response.status;
    error.alertas = data.alertas || [];
    error.detalles = data.detalles || [];
    throw error;
  }
  return data;
};

export const listarSolicitudes = (filters, signal) => solicitar(`/solicitudes?${new URLSearchParams(filters)}`, { signal });
export const obtenerSolicitud = (id, signal) => solicitar(`/solicitudes/${id}`, { signal });
export const obtenerAntecedentes = (tipoIdentificacion, identificacion, signal) => solicitar(`/antecedentes?${new URLSearchParams({ tipoIdentificacion, identificacion })}`, { signal });
export const listarAnimalesDisponibles = signal => solicitar('/animales-disponibles', { signal });
export const crearSolicitud = data => solicitar('/solicitudes', { method: 'POST', json: data });

export const editarSolicitud = (id, data) => solicitar(`/solicitudes/${id}`, { method: 'PATCH', json: data });
export const eliminarSolicitud = (id, actualizadoEn) => solicitar(`/solicitudes/${id}`, { method: 'DELETE', json: { actualizadoEn } });

export const registrarEtapa = (id, data) => solicitar(`/solicitudes/${id}/etapas`, { method: 'POST', json: data });

export const listarSeguimientos = (filters, signal) => solicitar(`/seguimientos?${new URLSearchParams(filters)}`, { signal });
export const registrarSeguimiento = (id, data) => solicitar(`/seguimientos/${id}/registrar`, { method: 'POST', json: data });
export const reprogramarSeguimiento = (id, data) => solicitar(`/seguimientos/${id}/reprogramar`, { method: 'POST', json: data });
export const registrarDevolucion = data => solicitar('/devoluciones', { method: 'POST', json: data });
