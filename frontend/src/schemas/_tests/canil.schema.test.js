import { describe, expect, it } from 'vitest';
import { aprobacionTrasladoSchema, crearCanilSchema, gestionarCanilSchema, trasladoSchema } from '../canil.schema.js';

describe('aprobacionTrasladoSchema', () => {
  it('acepta una aprobación sin comentario y un rechazo justificado', () => {
    expect(aprobacionTrasladoSchema.safeParse({ aprobar: true, comentario: '' }).success).toBe(true);
    expect(aprobacionTrasladoSchema.safeParse({ aprobar: false, comentario: 'Faltan antecedentes.' }).success).toBe(true);
  });

  it('exige un motivo para rechazar y limita la extensión', () => {
    expect(aprobacionTrasladoSchema.safeParse({ aprobar: false, comentario: ' ' }).success).toBe(false);
    expect(aprobacionTrasladoSchema.safeParse({ aprobar: true, comentario: 'x'.repeat(4001) }).success).toBe(false);
  });
});

describe('crearCanilSchema', () => {
  const valido = {
    sector: "Patio"
  };

  it('acepta los datos válidos del formulario', () => {
    expect(crearCanilSchema.safeParse(valido).success).toBe(true);
  });

  it.each([
    {
      sector: " "
    },
    {
      sector: 'x'.repeat(101)
    }
  ])('rechaza datos inválidos %#', cambio => {
    expect(crearCanilSchema.safeParse({ ...valido, ...cambio }).success).toBe(false);
  });
});

describe('gestionarCanilSchema', () => {
  const valido = {
    sectorEdicion: "Patio",
    selectedAnimalId: "",
    enCuarentena: false,
    motivoMovimiento: ""
  };

  it('acepta los datos válidos del formulario', () => {
    expect(gestionarCanilSchema.safeParse(valido).success).toBe(true);
  });

  it.each([
    {
      sectorEdicion: ""
    },
    {
      motivoMovimiento: 'a'
    }
  ])('rechaza datos inválidos %#', cambio => {
    expect(gestionarCanilSchema.safeParse({ ...valido, ...cambio }).success).toBe(false);
  });
});

describe('trasladoSchema', () => {
  const valido = {
    animalId: '1',
    tipo: "HOGAR_TEMPORAL",
    motivo: "Cuidados temporales",
    destinoNombre: "Hogar"
  };

  it('acepta los datos válidos del formulario', () => {
    expect(trasladoSchema.safeParse(valido).success).toBe(true);
  });

  it('pide un correo válido cuando el destino es una protectora aliada', () => {
    const protectora = { ...valido, tipo: 'PROTECTORA_ALIADA' };
    expect(trasladoSchema.safeParse(protectora).success).toBe(false);
    expect(trasladoSchema.safeParse({ ...protectora, destinoEmail: '123456' }).success).toBe(false);
    expect(trasladoSchema.safeParse({ ...protectora, destinoEmail: 'contacto@example.test' }).success).toBe(true);
    expect(trasladoSchema.safeParse({ ...valido, destinoEmail: '123456' }).success).toBe(true);
  });

  it.each([
    {
      animalId: "1.5"
    },
    {
      destinoNombre: 'X'
    },
    {
      motivo: 'A'
    }
  ])('rechaza datos inválidos %#', cambio => {
    expect(trasladoSchema.safeParse({ ...valido, ...cambio }).success).toBe(false);
  });
});
