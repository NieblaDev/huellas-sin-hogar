import { Router } from 'express';
import { obtenerFoto } from '../controllers/foto.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { fotoParamSchema } from '../schemas/foto.schema.js';

const router = Router();
router.get('/:archivo', validate(fotoParamSchema, 'params'), obtenerFoto);
export default router;
