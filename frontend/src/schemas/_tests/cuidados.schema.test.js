import { describe, expect, it } from 'vitest';
import { cumplimientoSchema, indicacionSchema } from '../cuidados.schema.js';

describe('cumplimientoSchema', () => {
  it('acepta un registro sin observaciones', () => {
    expect(cumplimientoSchema.safeParse({}).success).toBe(true);
  });

  it('limita la extensión de las observaciones', () => {
    expect(cumplimientoSchema.safeParse({ texto: 'a'.repeat(4001) }).success).toBe(false);
  });
});

describe('indicacionSchema', () => {
  const valido = {
    animalId: '1',
    contexto: "CIRUGIA",
    categoria: "HIGIENE_CURACION",
    criticidad: "ALTA",
    titulo: "Curación",
    instruccion: "Curar herida",
    franjaHoraria: "Mañana",
    fechaInicio: "2026-11-25",
    fechaFin: "2026-11-27"
  };

  it('acepta los datos válidos del formulario', () => {
    expect(indicacionSchema.safeParse(valido).success).toBe(true);
  });

  it.each([
    {
      titulo: 'A'
    },
    {
      instruccion: "abc"
    },
    {
      fechaInicio: "2026-02-30"
    },
    {
      fechaFin: "2026-11-24"
    }
  ])('rechaza datos inválidos %#', cambio => {
    expect(indicacionSchema.safeParse({ ...valido, ...cambio }).success).toBe(false);
  });
});
