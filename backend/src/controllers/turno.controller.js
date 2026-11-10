import * as turnoService from '../services/turno.service.js';

export const getTurnos = async (req, res) => {
  try {
    const data = await turnoService.getTurnos(req.query);
    res.json(data);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
};

export const getMatrizTurnos = async (req, res) => {
  try {
    const matriz = await turnoService.getMatrizTurnos();
    res.json(matriz);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
};

export const createTurno = async (req, res) => {
  try {
    const ip = req.ip || req.connection?.remoteAddress;
    const nuevo = await turnoService.createTurno(req.body, req.user, ip);
    res.status(201).json(nuevo);
  } catch (error) {
    res.status(error.statusCode || 400).json({ error: error.message });
  }
};

export const updateTurno = async (req, res) => {
  try {
    const ip = req.ip || req.connection?.remoteAddress;
    const { id } = req.params;
    const actualizado = await turnoService.updateTurno(id, req.body, req.user, ip);
    res.json(actualizado);
  } catch (error) {
    res.status(error.statusCode || 400).json({ error: error.message });
  }
};

export const deleteTurno = async (req, res) => {
  try {
    const ip = req.ip || req.connection?.remoteAddress;
    const { id } = req.params;
    const resultado = await turnoService.deleteTurno(id, req.user, ip);
    res.json(resultado);
  } catch (error) {
    res.status(error.statusCode || 400).json({ error: error.message });
  }
};

export const confirmarPlanificacion = async (req, res) => {
  try {
    const ip = req.ip || req.connection?.remoteAddress;
    const resultado = await turnoService.confirmarPlanificacionSemanal(req.user, ip);
    res.json(resultado);
  } catch (error) {
    res.status(error.statusCode || 400).json({ error: error.message });
  }
};

export const inscribirVoluntario = async (req, res) => {
  try {
    const ip = req.ip || req.connection?.remoteAddress;
    const { id } = req.params;
    const inscripcion = await turnoService.inscribirVoluntario(id, req.user, req.body, ip);
    res.status(201).json(inscripcion);
  } catch (error) {
    res.status(error.statusCode || 400).json({ error: error.message });
  }
};

export const desinscribirVoluntario = async (req, res) => {
  try {
    const ip = req.ip || req.connection?.remoteAddress;
    const { id } = req.params;
    const { usuarioId } = req.query;
    const resultado = await turnoService.desinscribirVoluntario(id, req.user, usuarioId, ip);
    res.json(resultado);
  } catch (error) {
    res.status(error.statusCode || 400).json({ error: error.message });
  }
};

export const solicitarPermuta = async (req, res) => {
  try {
    const ip = req.ip || req.connection?.remoteAddress;
    const permuta = await turnoService.solicitarPermuta(req.body, req.user, ip);
    res.status(201).json(permuta);
  } catch (error) {
    res.status(error.statusCode || 400).json({ error: error.message });
  }
};

export const getPermutas = async (req, res) => {
  try {
    const permutas = await turnoService.getPermutas(req.user);
    res.json(permutas);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
};

export const responderPermuta = async (req, res) => {
  try {
    const ip = req.ip || req.connection?.remoteAddress;
    const { id } = req.params;
    const { accion, observacion } = req.body;
    const resultado = await turnoService.responderPermuta(id, accion, observacion, req.user, ip);
    res.json(resultado);
  } catch (error) {
    res.status(error.statusCode || 400).json({ error: error.message });
  }
};

export const registrarBitacora = async (req, res) => {
  try {
    const ip = req.ip || req.connection?.remoteAddress;
    const { id } = req.params;
    const bitacora = await turnoService.registrarBitacora(id, req.body, req.user, ip);
    res.status(201).json(bitacora);
  } catch (error) {
    res.status(error.statusCode || 400).json({ error: error.message });
  }
};

export const getBitacorasTurno = async (req, res) => {
  try {
    const { id } = req.params;
    const bitacoras = await turnoService.getBitacorasTurno(id);
    res.json(bitacoras);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
};

export const getAlertasDescubiertos = async (req, res) => {
  try {
    const alertas = await turnoService.getTurnosDescubiertos();
    res.json(alertas);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
};

export const getDirectorioVoluntarios = async (req, res) => {
  try {
    const directorio = await turnoService.getDirectorioVoluntarios();
    res.json(directorio);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
};
