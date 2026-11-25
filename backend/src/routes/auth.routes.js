import { Router } from 'express';
import { login, obtenerSesion } from '../controllers/auth.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { loginSchema } from '../schemas/auth.schema.js';

const router = Router();
router.post('/login', validate(loginSchema, 'body'), login);
router.get('/sesion', authenticateToken, obtenerSesion);
export default router;
