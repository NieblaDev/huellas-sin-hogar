// Folios legibles para el personal del refugio.
const rellenar = (numero) => String(numero ?? 0).padStart(4, '0');

const anioDe = (fecha) => {
  const valor = new Date(fecha);
  return Number.isNaN(valor.getTime()) ? '' : `${valor.getFullYear()}-`;
};

export const folioSolicitud = (solicitud) =>
  solicitud ? `SOL-${anioDe(solicitud.creadoEn)}${rellenar(solicitud.id)}` : '';

export const folioSeguimiento = (seguimiento) =>
  seguimiento ? `SEG-${anioDe(seguimiento.creadoEn)}${rellenar(seguimiento.id)}` : '';
