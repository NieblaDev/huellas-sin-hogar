import { asyncHandler } from '../middlewares/error.middleware.js';
import * as animalService from '../services/animal.service.js';
import * as exportService from '../services/export.service.js';
import { obtenerNotificacionesPersonal } from '../services/notification.service.js';

const urlFoto = req => req.protocol + '://' + req.get('host') + '/api/animales/fotos/' + req.file.filename;

export const getAnimals = asyncHandler(async (req, res) => {
  const animals = await animalService.getAllAnimals(req.query);
  res.json(animals);
});

export const getAnimalById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const ficha = await animalService.getAnimalById(id, req.user);
  res.json(ficha);
});

export const createAnimal = asyncHandler(async (req, res) => {
  const ip = req.ip;
  const data = { ...req.body };
  if (req.file) data.fotoUrl = urlFoto(req);
  const newAnimal = await animalService.createAnimal(data, req.user, ip);
  res.status(201).json(newAnimal);
});

export const updateAnimal = asyncHandler(async (req, res) => {
  const ip = req.ip;
  const { id } = req.params;
  const data = req.file ? { ...req.body, eliminarFoto: false, fotoUrl: urlFoto(req) } : req.body;

  const updated = await animalService.updateAnimal(id, data, req.user, ip);
  res.json(updated);
});

export const deleteAnimal = asyncHandler(async (req, res) => {
  const ip = req.ip;
  const { id } = req.params;
  await animalService.deleteAnimal(id, req.user, ip);
  res.json({ message: 'Animal dado de baja lógicamente con éxito' });
});

export const getNotifications = asyncHandler(async (req, res) => {
  const notificaciones = await obtenerNotificacionesPersonal(req.query.limit ?? 15);
  res.json({ notificaciones });
});

export const exportAnimalPdf = asyncHandler(async (req, res) => {
  const ip = req.ip;
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
});

export const exportConsolidatedCsv = asyncHandler(async (req, res) => {
  const ip = req.ip;
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
});
