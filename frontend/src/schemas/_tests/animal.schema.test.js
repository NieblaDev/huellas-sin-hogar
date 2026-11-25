import { describe, expect, it } from 'vitest';
import { fichaAnimalSchema } from '../animal.schema.js';

describe('fichaAnimalSchema', () => {
  const valido = {
    nombre: "Luna",
    especie: "Perro",
    sexo: "Hembra",
    tipoIngreso: "Rescate",
    estadoSalud: "NORMAL"
  };

  it('acepta los datos válidos del formulario', () => {
    expect(fichaAnimalSchema.safeParse(valido).success).toBe(true);
  });

  it.each([
    {
      nombre: " "
    },
    {
      especie: "Ave"
    },
    {
      peso: "-1"
    },
    {
      canilId: '0'
    }
  ])('rechaza datos inválidos %#', cambio => {
    expect(fichaAnimalSchema.safeParse({ ...valido, ...cambio }).success).toBe(false);
  });
});
