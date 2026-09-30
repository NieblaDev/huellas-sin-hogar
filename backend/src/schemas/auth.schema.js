import { z } from 'zod';
export const loginSchema = z.object({
  email: z.string().email('Debe ser un email válido'),
  password: z.string().min(6, 'Mínimo 6 caracteres')
});