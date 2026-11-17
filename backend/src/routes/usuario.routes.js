import { Router } from 'express';
import { listarUsuarios, crearUsuario, eliminarUsuario } from '../controllers/usuario.controller.js';
import { authenticateToken, requireRole } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { crearUsuarioSchema, emailUsuarioParamSchema } from '../schemas/usuario.schema.js';

const router = Router();

// La gestión de perfiles y permisos es exclusiva de la Dirección.
router.use(authenticateToken, requireRole('DIRECTORA'));

router.get('/', listarUsuarios);
router.post('/', validate(crearUsuarioSchema, 'body'), crearUsuario);
router.delete('/:email', validate(emailUsuarioParamSchema, 'params'), eliminarUsuario);

export default router;
