import { responderJson } from '../middlewares/error.middleware.js';
import * as service from '../services/seguimiento.service.js';

export const listarSeguimientos = responderJson(req => service.listarSeguimientos(req.query));
export const obtenerSeguimiento = responderJson(req => service.obtenerSeguimiento(req.params.id));
export const programarSeguimiento = responderJson(req => service.programarSeguimientoManual(req.body, req.adopcionStaff, req.ip), 201);
export const registrarSeguimiento = responderJson(req => service.registrarSeguimiento(req.params.id, req.body, req.adopcionStaff, req.ip));
export const reprogramarSeguimiento = responderJson(req => service.reprogramarSeguimiento(req.params.id, req.body, req.adopcionStaff, req.ip));
export const obtenerConfiguracion = responderJson(() => service.obtenerConfiguracionLimite());
export const actualizarConfiguracion = responderJson(req => service.actualizarConfiguracionLimite(req.body, req.adopcionStaff, req.ip));
