import { describe, expect, it } from 'vitest';
import { insumoSchema, movimientoSchema } from '../insumo.schema.js';

describe('insumoSchema', () => {
  const valido = {
    nombre: "Alimento",
    categoria: "Comida",
    stock: '0',
    stockMinimo: 5,
    unidad: "Kg",
    esFarmaco: false
  };

  it('acepta los datos válidos del formulario', () => {
    expect(insumoSchema.safeParse(valido).success).toBe(true);
  });

  it.each([
    {
      nombre: 'A'
    },
    {
      stock: ""
    },
    {
      stock: "-1"
    },
    {
      stock: "0.5"
    },
    {
      fechaVencimiento: "2026-11-32"
    }
  ])('rechaza datos inválidos %#', cambio => {
    expect(insumoSchema.safeParse({ ...valido, ...cambio }).success).toBe(false);
  });
});

describe('movimientoSchema', () => {
  const valido = {
    insumoId: '1',
    tipo: "SALIDA",
    subtipo: "CONSUMO",
    cantidad: '1',
    motivo: "Ración diaria"
  };

  it('acepta los datos válidos del formulario', () => {
    expect(movimientoSchema.safeParse(valido).success).toBe(true);
  });

  it.each([
    {
      cantidad: '0'
    },
    {
      subtipo: "COMPRA"
    },
    {
      motivo: 'a'
    }
  ])('rechaza datos inválidos %#', cambio => {
    expect(movimientoSchema.safeParse({ ...valido, ...cambio }).success).toBe(false);
  });
});
