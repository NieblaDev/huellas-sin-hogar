import fs from 'fs';
import path from 'path';
import { uploadsPath } from '../services/foto.service.js';
import { randomUUID } from 'node:crypto';
import multer from 'multer';

if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}

const MIME_PERMITIDOS = ['image/jpeg', 'image/png', 'image/jpg'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsPath),
  filename: (req, file, cb) => {
    const ext = file.mimetype === 'image/png' ? '.png' : '.jpg';
    const base = path
      .basename(file.originalname, path.extname(file.originalname))
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .slice(0, 60) || 'foto';
    cb(null, Date.now() + '_' + randomUUID() + '_' + base + ext);
  }
});

const fileFilter = (req, file, cb) => {
  if (MIME_PERMITIDOS.includes(file.mimetype)) return cb(null, true);
  cb(new Error('Formato de imagen no permitido. Usa archivos JPG o PNG.'));
};
export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE }
});

/**
 * Envuelve `upload.single(campo)` para responder errores de Multer en JSON (400)
 * en lugar de dejar que Express devuelva un error HTML genérico.
 */
export const uploadSingle = (campo = 'foto') => (req, res, next) => {
  upload.single(campo)(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'La imagen supera el tamaño máximo permitido (10 MB).' });
    }
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: 'Selecciona una sola foto en formato JPG o PNG.' });
    }
    return res.status(400).json({ error: err.message || 'No se pudo procesar la imagen.' });
  });
};
