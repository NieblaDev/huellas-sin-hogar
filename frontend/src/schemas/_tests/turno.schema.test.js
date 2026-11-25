import { describe, expect, it } from 'vitest';
import { turnoSchema, permutaSchema, bitacoraSchema, asignarVoluntarioSchema } from '../turno.schema.js';

describe('turnoSchema', () => {
  const valido = {
    diaSemana: "Lunes",
    franja: "Mañana",
    area: "Paseos",
    cupoMaximo: 1,
    esCritica: false
  };

  it('acepta los datos válidos del formulario', () => {
    expect(turnoSchema.safeParse(valido).success).toBe(true);
  });

  it.each([
    {
      cupoMaximo: 0
    },
    {
      cupoMaximo: 1.5
    },
    {
      area: 'A'
    }
  ])('rechaza datos inválidos %#', cambio => {
    expect(turnoSchema.safeParse({ ...valido, ...cambio }).success).toBe(false);
  });
});

describe('permutaSchema', () => {
  const valido = {
    turnoOrigenId: '1',
    destinatarioId: '2',
    motivo: "Cambio de disponibilidad"
  };

  it('acepta los datos válidos del formulario', () => {
    expect(permutaSchema.safeParse(valido).success).toBe(true);
  });

  it.each([
    {
      turnoOrigenId: '0'
    },
    {
      motivo: "Hola"
    }
  ])('rechaza datos inválidos %#', cambio => {
    expect(permutaSchema.safeParse({ ...valido, ...cambio }).success).toBe(false);
  });
});

describe('bitacoraSchema', () => {
  const valido = {
    tareasRealizadas: "Paseo y alimentación"
  };

  it('acepta los datos válidos del formulario', () => {
    expect(bitacoraSchema.safeParse(valido).success).toBe(true);
  });

  it.each([
    {
      tareasRealizadas: "Hola"
    }
  ])('rechaza datos inválidos %#', cambio => {
    expect(bitacoraSchema.safeParse({ ...valido, ...cambio }).success).toBe(false);
  });
});

describe('asignarVoluntarioSchema', () => {
  const valido = {
    voluntarioAAsignarId: '3'
  };

  it('acepta los datos válidos del formulario', () => {
    expect(asignarVoluntarioSchema.safeParse(valido).success).toBe(true);
  });

  it.each([
    {
      voluntarioAAsignarId: "3e2"
    }
  ])('rechaza datos inválidos %#', cambio => {
    expect(asignarVoluntarioSchema.safeParse({ ...valido, ...cambio }).success).toBe(false);
  });
});
