import { responderJson } from '../middlewares/error.middleware.js';
import * as service from '../services/devolucion.service.js';

export const registrarDevolucion = responderJson(req => service.registrarDevolucion(req.body, req.adopcionStaff, req.ip), 201);
export const listarDevoluciones = responderJson(req => service.listarDevoluciones(req.query));
export const obtenerDevolucion = responderJson(req => service.obtenerDevolucion(req.params.id));
