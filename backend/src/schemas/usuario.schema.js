import { z } from 'zod';
import { ROLES_USUARIO } from '../constants/usuarios.js';

const email = z
  .string()
  .trim()
  .min(1, 'El correo electrónico es obligatorio')
  .max(120, 'El correo electrónico no puede superar los 120 caracteres')
  .email('Debe ser un correo electrónico válido')
  .transform(valor => valor.toLowerCase());

export const crearUsuarioSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede superar los 100 caracteres'),
  email,
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(72, 'La contraseña no puede superar los 72 caracteres')
    .regex(/[A-Za-z]/, 'La contraseña debe incluir al menos una letra')
    .regex(/\d/, 'La contraseña debe incluir al menos un número'),
  rol: z.enum(ROLES_USUARIO, {
    errorMap: () => ({ message: 'Selecciona un perfil de usuario válido' })
  })
}).strict();

export const emailUsuarioParamSchema = z.object({
  email
}).strict();
