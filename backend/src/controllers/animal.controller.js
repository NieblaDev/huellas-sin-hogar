import * as animalService from '../services/animal.service.js';
import * as exportService from '../services/export.service.js';
import { obtenerNotificacionesPersonal } from '../services/notification.service.js';
import { buildPublicUrl } from '../middlewares/upload.middleware.js';

export const getAnimals = async (req, res) => {
  try {
    const animals = await animalService.getAllAnimals(req.query);
    res.json(animals);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Error al consultar animales' });
  }
};

export const getAnimalById = async (req, res) => {
  try {
    const { id } = req.params;
    const ficha = await animalService.getAnimalById(id, req.user);
    res.json(ficha);
  } catch (error) {
    res.status(404).json({ error: error.message || 'Error al consultar la ficha del animal' });
  }
};

export const createAnimal = async (req, res) => {
  try {
    const ip = req.ip || req.connection?.remoteAddress;
    const data = { ...req.body };
    // Fotografía subida con Multer: se guarda su URL pública en la ficha del animal
    if (req.file) {
      data.fotoUrl = buildPublicUrl(req, req.file.filename);
    }
    const newAnimal = await animalService.createAnimal(data, req.user, ip);
    res.status(201).json(newAnimal);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const updateAnimal = async (req, res) => {
  try {
    const ip = req.ip || req.connection?.remoteAddress;
    const { id } = req.params;
    const data = { ...req.body };

    // En envíos multipart/form-data los campos numéricos llegan como texto si no pasaron por el transform
    if (typeof data.peso === 'string') data.peso = data.peso.trim() === '' ? 0 : Number(data.peso) || 0;
    if (typeof data.canilId === 'string') data.canilId = data.canilId.trim() === '' ? null : Number(data.canilId);

    if (req.file) {
      data.fotoUrl = buildPublicUrl(req, req.file.filename);
    } else if (data.eliminarFoto === true || data.eliminarFoto === 'true') {
      data.fotoUrl = null;
    }

    const updated = await animalService.updateAnimal(id, data, req.user, ip);
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteAnimal = async (req, res) => {
  try {
    const ip = req.ip || req.connection?.remoteAddress;
    const { id } = req.params;
    await animalService.deleteAnimal(id, req.user, ip);
    res.json({ message: 'Animal dado de baja lógicamente con éxito' });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Error al eliminar el animal' });
  }
};

export const getNotifications = async (req, res) => {
  try {
    const notificaciones = await obtenerNotificacionesPersonal(Number(req.query.limit) || 15);
    res.json({ notificaciones });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Error al obtener notificaciones del personal' });
  }
};

export const exportAnimalPdf = async (req, res) => {
  try {
    const ip = req.ip || req.connection?.remoteAddress;
    const { id } = req.params;
    const { buffer, filename, contentType, notificacion } = await exportService.generarFichaAnimalPDF(
      id,
      req.user,
      ip,
      req.query
    );

    res.setHeader('Content-Type', contentType || 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, X-Notification-Message');
    res.setHeader('X-Notification-Message', encodeURIComponent(notificacion.mensaje));
    res.send(buffer);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Error al exportar expediente del animal' });
  }
};

export const exportConsolidatedCsv = async (req, res) => {
  try {
    const ip = req.ip || req.connection?.remoteAddress;
    const { buffer, csv, filename, contentType, notificacion } = await exportService.generarReporteConsolidadoCSV(
      req.user,
      ip,
      req.query
    );

    res.setHeader('Content-Type', contentType || 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, X-Notification-Message');
    res.setHeader('X-Notification-Message', encodeURIComponent(notificacion.mensaje));
    res.send(buffer || csv);
  } catch (error) {
    res.status(403).json({ error: error.message || 'Error al exportar reporte consolidado' });
  }
};