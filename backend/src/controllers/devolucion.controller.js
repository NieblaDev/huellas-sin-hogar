import * as service from '../services/devolucion.service.js';
import { AdopcionError } from '../services/adopcion.service.js';

const responder = (operacion, status = 200) => async (req, res) => {
  try {
    res.status(status).json(await operacion(req));
  } catch (error) {
    if (error instanceof AdopcionError) {
      return res.status(error.status).json({ error: error.message, alertas: error.alertas });
    }
    console.error('Error en devolucion.controller:', error);
    res.status(500).json({ error: 'No se pudo completar la operación de devolución' });
  }
};

export const registrarDevolucion = responder(req => service.registrarDevolucion(req.body, req.adopcionStaff, req.ip), 201);
export const listarDevoluciones = responder(req => service.listarDevoluciones(req.query));
export const obtenerDevolucion = responder(req => service.obtenerDevolucion(req.params.id));
