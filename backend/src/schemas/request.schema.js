import { z } from 'zod';

export const sinParametrosSchema = z.object({});
export const idNumerico = z.string().regex(/^\d+$/).transform(Number)
  .pipe(z.number().int().positive().max(2_147_483_647));
export const idParamSchema = z.object({ id: idNumerico });
export const animalIdParamSchema = z.object({ animalId: idNumerico });
export const fechaConsulta = z.union([z.string().date(), z.string().datetime({ offset: true })]);
