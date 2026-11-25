import { responderJson } from '../middlewares/error.middleware.js';
import { modificarSolicitud } from '../services/solicitudEdicion.service.js';
import * as service from '../services/adopcion.service.js';

export const crearSolicitud = responderJson(req => service.crearSolicitud(req.body, req.adopcionStaff, req.ip), 201);
export const listarSolicitudes = responderJson(req => service.listarSolicitudes(req.query));
export const obtenerSolicitud = responderJson(req => service.obtenerSolicitud(req.params.id));
export const obtenerAntecedentes = responderJson(req => service.obtenerAntecedentes(req.query));
export const listarAnimalesDisponibles = responderJson(() => service.listarAnimalesDisponibles());

export const editarSolicitud = responderJson(req => modificarSolicitud(req.params.id, req.body, req.adopcionStaff, req.ip));
export const eliminarSolicitud = responderJson(req => modificarSolicitud(req.params.id, req.body, req.adopcionStaff, req.ip, true));
