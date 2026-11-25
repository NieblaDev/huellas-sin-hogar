import { z } from 'zod';

export const texto = (minimo = 1, maximo) => {
  const campo = z.string().trim().min(minimo, minimo === 1 ? 'Completa este campo.' : `Escribe al menos ${minimo} caracteres.`);
  return maximo ? campo.max(maximo, `Usa como máximo ${maximo} caracteres.`) : campo;
};

export const opcional = maximo => texto(0, maximo).optional();
export const fecha = z.string().date('Selecciona una fecha válida.');
export const fechaOpcional = z.union([fecha, z.literal('')]).optional();
export const fechaHora = z.string().refine(valor => /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(valor)
  && fecha.safeParse(valor.slice(0, 10)).success && Number.isFinite(new Date(valor).getTime()),
'Selecciona una fecha y hora válidas.');

export const idSeleccion = z.union([z.string().regex(/^\d+$/), z.number().int()])
  .refine(valor => Number(valor) > 0 && Number(valor) <= 2_147_483_647, 'Selecciona una opción válida.');

export const numeroFormulario = (minimo, entero = false) => z.union([z.string(), z.number()])
  .refine(valor => String(valor).trim() !== '' && Number.isFinite(Number(valor))
    && (minimo === undefined || Number(valor) >= minimo) && (!entero || Number.isInteger(Number(valor))),
  minimo === undefined ? 'Ingresa un número válido.' : `Ingresa un número ${entero ? 'entero ' : ''}mayor o igual a ${minimo}.`);
