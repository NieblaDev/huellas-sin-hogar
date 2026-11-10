import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Carpeta `uploads/` en la raíz del backend (backend/uploads)
export const uploadsPath = path.resolve(__dirname, '../../uploads');

if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}

const MIME_PERMITIDOS = ['image/jpeg', 'image/png', 'image/jpg'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsPath),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path
      .basename(file.originalname, ext)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .slice(0, 60) || 'foto';
    const safeName = `${base}${ext}`;
    cb(null, `${Date.now()}_${safeName}`);
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
    return res.status(400).json({ error: err.message || 'No se pudo procesar la imagen.' });
  });
};

/**
 * Construye la URL pública de un archivo subido.
 */
export const buildPublicUrl = (req, filename) => `${req.protocol}://${req.get('host')}/uploads/${filename}`;
