import { asyncHandler } from '../middlewares/error.middleware.js';
import { obtenerArchivoFoto } from '../services/foto.service.js';

export const obtenerFoto = asyncHandler(async (req, res) => {
  const { archivo, root } = await obtenerArchivoFoto(req.params.archivo);
  res.set('X-Content-Type-Options', 'nosniff');
  res.sendFile(archivo, { root, maxAge: '7d' });
});
