const MENSAJE_GENERAL = 'No se pudo completar la operación. Intenta nuevamente.';

const formatearMensaje = (mensaje, alternativo) => {
  if (typeof mensaje !== 'string' || !mensaje.trim()) return alternativo;
  if (/^(?:Failed to fetch|NetworkError|Load failed|fetch failed)/i.test(mensaje)) {
    return 'No pudimos conectarnos con el refugio. Revisa tu conexión e intenta nuevamente.';
  }
  if (/\bID\s+(?:de|inv[aá]lido)\b|#\s*\d+/.test(mensaje)) return alternativo;
  if (/\b(?:Prisma\w*|prisma\.\w+|P\d{4}|ZodError)\b|^(?:Error \d{3}|Unexpected token|Unexpected end|Invalid input|Invalid enum|Expected |Required$|Cannot )/i.test(mensaje) || /\b[a-z]\w*Id\b/.test(mensaje)) {
    return alternativo;
  }
  return mensaje.trim();
};

export const formatearErrorApi = (error, alternativo = MENSAJE_GENERAL) => {
  if (Array.isArray(error?.detalles) && error.detalles.length) {
    return [...new Set(error.detalles.map(({ mensaje }) => {
      const texto = formatearMensaje(mensaje, 'Revisa los datos ingresados.');
      return /[.!?]$/.test(texto) ? texto : texto + '.';
    }))].join(' ');
  }

  const mensaje = typeof error === 'string' ? error : error?.error || error?.message;
  return formatearMensaje(mensaje, alternativo);
};
