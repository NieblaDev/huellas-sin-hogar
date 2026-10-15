import * as canilService from '../services/canil.service.js';

export const getCaniles = async (req, res) => {
  try {
    const data = await canilService.getAllCaniles();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Error al obtener caniles' });
  }
};

export const asignarCanil = async (req, res) => {
  try {
    const ip = req.ip || req.connection?.remoteAddress;
    const resultado = await canilService.asignarCanil(req.body, req.user, ip);
    res.json(resultado);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const solicitarTrasladoExterno = async (req, res) => {
  try {
    const ip = req.ip || req.connection?.remoteAddress;
    const traslado = await canilService.solicitarTrasladoExterno(req.body, req.user, ip);
    res.status(201).json({
      message: 'Solicitud de traslado registrada con éxito. Requiere aprobación de la Directora.',
      traslado
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const gestionarAprobacion = async (req, res) => {
  try {
    const ip = req.ip || req.connection?.remoteAddress;
    const { id } = req.params;
    const traslado = await canilService.gestionarAprobacionTraslado(id, req.body, req.user, ip);
    res.json({
      message: `Traslado ${traslado.estado.toLowerCase()} exitosamente`,
      traslado
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getTraslados = async (req, res) => {
  try {
    const traslados = await canilService.getTraslados(req.query);
    res.json(traslados);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Error al obtener traslados' });
  }
};
