import { z } from 'zod';

export const fotoParamSchema = z.object({
  archivo: z.string().regex(/^\d+_[a-z0-9_-]+\.(jpe?g|png)$/i)
});
