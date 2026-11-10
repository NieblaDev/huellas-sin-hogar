import { Router } from 'express';
import authRoutes from './auth.routes.js';
import animalRoutes from './animal.routes.js';
import canilRoutes from './canil.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import auditRoutes from './audit.routes.js';
import insumoRoutes from './insumo.routes.js';
import postulanteRoutes from './postulante.routes.js';
import cuidadosRoutes from './cuidados.routes.js';
import saludRoutes from './salud.routes.js';
import adopcionRoutes from './adopcion.routes.js';
import turnoRoutes from './turno.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/animals', animalRoutes);
router.use('/animales', animalRoutes);
router.use('/caniles', canilRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/auditoria', auditRoutes);
router.use('/insumos', insumoRoutes);
router.use('/postulantes', postulanteRoutes);
router.use('/cuidados', cuidadosRoutes);
router.use('/salud', saludRoutes);
router.use('/adopciones', adopcionRoutes);
router.use('/turnos', turnoRoutes);
router.use('/voluntarios', turnoRoutes);

export default router;
