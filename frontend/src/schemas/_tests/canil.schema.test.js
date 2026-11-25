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

  it('acepta un correo opcional y rechaza direcciones inválidas', () => {
    expect(trasladoSchema.safeParse({ ...valido, destinoEmail: '' }).success).toBe(true);
    expect(trasladoSchema.parse({ ...valido, destinoEmail: ' contacto@example.test ' }).destinoEmail).toBe('contacto@example.test');
    expect(trasladoSchema.safeParse({ ...valido, destinoEmail: 'contacto' }).success).toBe(false);
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
