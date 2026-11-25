const erroresPrisma = {
  P2002: [409, 'Ya existe un registro con esos datos.'],
  P2025: [404, 'No se encontró el registro solicitado.'],
  P2003: [400, 'La operación contiene una referencia inválida o el registro está en uso.'],
  P2034: [409, 'Los datos cambiaron durante la operación. Actualiza la vista e inténtalo de nuevo.']
};

export const asyncHandler = handler => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

export const responderJson = (operacion, status = 200) => asyncHandler(async (req, res) => {
  res.status(status).json(await operacion(req));
});

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  if (Object.hasOwn(erroresPrisma, error.code)) {
    const [status, mensaje] = erroresPrisma[error.code];
    return res.status(status).json({ error: mensaje });
  }

  const status = error.statusCode ?? error.status;
  if (Number.isInteger(status) && status >= 400 && status < 500) {
    const mensaje = error.type === 'entity.parse.failed' ? 'El cuerpo JSON no es válido.' : error.message;
    return res.status(status).json({ error: mensaje, alertas: error.alertas });
  }

  console.error('Error inesperado:', error.code || error.name);
  return res.status(500).json({ error: 'No se pudo completar la operación.' });
}
