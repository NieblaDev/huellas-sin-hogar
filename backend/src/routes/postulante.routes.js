import { validate } from '../middlewares/validate.middleware.js';
import { sinParametrosSchema, idParamSchema } from '../schemas/request.schema.js';
import { crearPostulanteSchema, actualizarPostulanteSchema } from '../schemas/postulante.schema.js';
import { Router } from 'express';
import { getPostulantes, createPostulante, updatePostulante, deletePostulante } from '../controllers/postulante.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', authenticateToken, validate(sinParametrosSchema, 'query'), getPostulantes);
router.post('/', authenticateToken, validate(crearPostulanteSchema), createPostulante);
router.put('/:id', authenticateToken, validate(idParamSchema, 'params'), validate(actualizarPostulanteSchema), updatePostulante);
router.delete('/:id', authenticateToken, validate(idParamSchema, 'params'), deletePostulante);

export default router;
