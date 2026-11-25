import { describe, expect, it } from 'vitest';
import { vacunaSchema, atencionSchema } from '../salud.schema.js';

describe('vacunaSchema', () => {
  const valido = {
    animalId: 4,
    nombreVacuna: "Triple",
    dosis: "Única",
    fechaVencimiento: "2026-12-20"
  };

  it('acepta los datos válidos del formulario', () => {
    expect(vacunaSchema.safeParse(valido).success).toBe(true);
  });

  it.each([
    {
      nombreVacuna: 'A'
    },
    {
      fechaVencimiento: "20/12/2026"
    }
  ])('rechaza datos inválidos %#', cambio => {
    expect(vacunaSchema.safeParse({ ...valido, ...cambio }).success).toBe(false);
  });
});

describe('atencionSchema', () => {
  const valido = {
    animalId: '4',
    motivo: "Control",
    diagnostico: "Sin lesiones"
  };

  it('acepta los datos válidos del formulario', () => {
    expect(atencionSchema.safeParse(valido).success).toBe(true);
  });

  it.each([
    {
      diagnostico: "Ok"
    },
    {
      pesoActual: '0'
    },
    {
      temperatura: "normal"
    }
  ])('rechaza datos inválidos %#', cambio => {
    expect(atencionSchema.safeParse({ ...valido, ...cambio }).success).toBe(false);
  });
});
