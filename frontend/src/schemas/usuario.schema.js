import { z } from 'zod';
import { texto } from './campos.js';

const sexo = z.enum(['FEMENINO', 'MASCULINO', 'NEUTRO']);
const rol = z.enum(['DIRECCION', 'PERSONAL_VETERINARIO', 'PERSONAL_ADOPCIONES', 'VOLUNTARIO_AVANZADO', 'VOLUNTARIO_NOVATO']);
const password = z.string().min(8, 'Usa al menos 8 caracteres.').max(72, 'Usa como máximo 72 caracteres.')
  .regex(/[A-Za-z]/, 'Incluye al menos una letra.').regex(/\d/, 'Incluye al menos un número.');

export const perfilSchema = z.object({
  nombre: texto(2, 100),
  email: z.string().trim().email('Ingresa un correo electrónico válido.').max(120),
  sexo, rol, password,
  confirmar: z.string()
}).refine(datos => datos.password === datos.confirmar, {
  path: ['confirmar'], message: 'Las contraseñas deben coincidir.'
});

export const editarSexoSchema = z.object({ sexoEditado: sexo });
