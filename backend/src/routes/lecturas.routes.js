import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/prisma.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';

const router = Router();
const clave = z.string().max(100).regex(/^(animales|caniles):[a-z0-9:-]+$/i);
router.use(authenticateToken);

router.post('/consultar', validate(z.object({ claves: z.array(clave).max(60) })), asyncHandler(async (req, res) => {
  const filas = await prisma.lecturaNotificacion.findMany({
    where: { usuarioId: req.user.id, clave: { in: req.body.claves } },
    select: { clave: true }
  });
  res.json(filas.map(fila => fila.clave));
}));

router.put('/', validate(z.object({ clave })), asyncHandler(async (req, res) => {
  await prisma.lecturaNotificacion.createMany({
    data: [{ usuarioId: req.user.id, clave: req.body.clave }],
    skipDuplicates: true
  });
  res.sendStatus(204);
}));

export default router;
