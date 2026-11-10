import * as service from '../services/seguimiento.service.js';
import { AdopcionError } from '../services/adopcion.service.js';

const responder = (operacion, status = 200) => async (req, res) => {
  try {
    res.status(status).json(await operacion(req));
  } catch (error) {
    if (error instanceof AdopcionError) {
      return res.status(error.status).json({ error: error.message, alertas: error.alertas });
    }
    console.error('Error en seguimiento.controller:', error);
    res.status(500).json({ error: 'No se pudo completar la operación de seguimiento' });
  }
};

export const listarSeguimientos = responder(req => service.listarSeguimientos(req.query));
export const obtenerSeguimiento = responder(req => service.obtenerSeguimiento(req.params.id));
export const programarSeguimiento = responder(req => service.programarSeguimientoManual(req.body, req.adopcionStaff, req.ip), 201);
export const registrarSeguimiento = responder(req => service.registrarSeguimiento(req.params.id, req.body, req.adopcionStaff, req.ip));
export const reprogramarSeguimiento = responder(req => service.reprogramarSeguimiento(req.params.id, req.body, req.adopcionStaff, req.ip));
export const obtenerConfiguracion = responder(() => service.obtenerConfiguracionLimite());
export const actualizarConfiguracion = responder(req => service.actualizarConfiguracionLimite(req.body, req.adopcionStaff, req.ip));
