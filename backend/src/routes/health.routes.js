import { Router } from 'express';
import { obtenerEstado } from '../controllers/health.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { sinParametrosSchema } from '../schemas/request.schema.js';

const router = Router();
router.get('/', validate(sinParametrosSchema, 'query'), obtenerEstado);
export default router;
