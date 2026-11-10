import { modificarSolicitud } from '../services/solicitudEdicion.service.js';
import * as service from '../services/adopcion.service.js';

const responder = (operacion, status = 200) => async (req, res) => {
  try {
    res.status(status).json(await operacion(req));
  } catch (error) {
    if (error instanceof service.AdopcionError) {
      return res.status(error.status).json({ error: error.message, alertas: error.alertas });
    }
    res.status(500).json({ error: 'No se pudo completar la operación de adopciones' });
  }
};

export const crearSolicitud = responder(req => service.crearSolicitud(req.body, req.adopcionStaff, req.ip), 201);
export const listarSolicitudes = responder(req => service.listarSolicitudes(req.query));
export const obtenerSolicitud = responder(req => service.obtenerSolicitud(req.params.id));
export const obtenerAntecedentes = responder(req => service.obtenerAntecedentes(req.query));
export const listarAnimalesDisponibles = responder(() => service.listarAnimalesDisponibles());

export const editarSolicitud = responder(req => modificarSolicitud(req.params.id, req.body, req.adopcionStaff, req.ip));
export const eliminarSolicitud = responder(req => modificarSolicitud(req.params.id, req.body, req.adopcionStaff, req.ip, true));
