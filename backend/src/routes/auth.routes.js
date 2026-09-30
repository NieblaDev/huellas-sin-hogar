import { Router } from 'express';
import { login } from '../controllers/auth.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { loginSchema } from '../schemas/auth.schema.js';

const router = Router();
router.post('/login', validate(loginSchema, 'body'), login);
export default router;