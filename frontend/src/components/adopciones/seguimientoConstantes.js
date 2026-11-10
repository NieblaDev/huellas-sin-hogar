export const ESTADOS_SEGUIMIENTO = {
  PENDIENTE: 'Pendiente', REPROGRAMADO: 'Reprogramado', COMPLETADO: 'Completado', SIN_CONTACTO: 'Sin contacto'
};
export const TIPOS_SEGUIMIENTO = {
  SEGUIMIENTO_15_DIAS: 'Seguimiento a los 15 días', SEGUIMIENTO_30_DIAS: 'Seguimiento a los 30 días', EXTRAORDINARIO: 'Seguimiento extraordinario'
};
// Valores aceptados por el esquema del backend (se normalizan al enum CanalContacto).
export const CANALES_FORMULARIO = {
  VISITA_PRESENCIAL: 'Visita presencial', VIDEOLLAMADA: 'Videollamada', LLAMADA_TELEFONICA: 'Llamada telefónica',
  WHATSAPP: 'WhatsApp', CORREO: 'Correo electrónico', OTRO: 'Otro'
};
export const CANALES = {
  LLAMADA_TELEFONICA: 'Llamada telefónica', WHATSAPP: 'WhatsApp', CORREO_ELECTRONICO: 'Correo electrónico',
  VISITA_DOMICILIARIA: 'Visita presencial', OTRO: 'Otro (incluye videollamada)'
};
export const ahoraLocal = () => {
  const fecha = new Date();
  return new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
};
export const mensajeError = err => [err.message, ...(err.detalles || []).map(d => d.mensaje)].join(' ');
