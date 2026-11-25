import { stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { ErrorDominio } from '../utils/errorDominio.js';

export const uploadsPath = fileURLToPath(new URL('../../uploads/', import.meta.url));

export async function obtenerArchivoFoto(archivo) {
  const informacion = await stat(join(uploadsPath, archivo)).catch(error => {
    if (error.code !== 'ENOENT') throw error;
  });
  if (!informacion?.isFile()) throw new ErrorDominio(404, 'No se encontró la fotografía.');
  return { archivo, root: uploadsPath };
}
