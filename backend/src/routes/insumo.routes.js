import { Router } from 'express';
import { getInsumos, createInsumo, updateInsumo, deleteInsumo } from '../controllers/insumo.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', authenticateToken, getInsumos);
router.post('/', authenticateToken, createInsumo);
router.put('/:id', authenticateToken, updateInsumo);
router.delete('/:id', authenticateToken, deleteInsumo);

export default router;
