import { API_URL, getAuthHeaders } from './config';

const request = async (path, options = {}) => {
  const response = await fetch(`${API_URL}/adopciones${path}`, {
    ...options, headers: getAuthHeaders(), cache: 'no-store'
  });
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

export const listarSolicitudes = (filters, signal) => request(`/solicitudes?${new URLSearchParams(filters)}`, { signal });
export const obtenerSolicitud = (id, signal) => request(`/solicitudes/${id}`, { signal });
export const obtenerAntecedentes = (tipoIdentificacion, identificacion, signal) => request(`/antecedentes?${new URLSearchParams({ tipoIdentificacion, identificacion })}`, { signal });
export const listarAnimalesDisponibles = signal => request('/animales-disponibles', { signal });
export const crearSolicitud = data => request('/solicitudes', { method: 'POST', body: JSON.stringify(data) });

export const editarSolicitud = (id, data) => request(`/solicitudes/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const eliminarSolicitud = (id, actualizadoEn) => request(`/solicitudes/${id}`, { method: 'DELETE', body: JSON.stringify({ actualizadoEn }) });
