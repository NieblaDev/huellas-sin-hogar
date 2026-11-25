import { describe, expect, it } from 'vitest';
import { solicitudSchema, etapaSchema, seguimientoSchema, devolucionSchema } from '../adopcion.schema.js';

describe('solicitudSchema', () => {
  const valido = {
    postulante: {
      tipoIdentificacion: "RUT",
      identificacion: "12.345.678-5",
      nombre: "Ana Pérez",
      email: "ana@example.test",
      telefono: "+56 9 1234 5678",
      direccion: "Los Aromos 123"
    },
    animalId: '7',
    motivacion: "Tengo espacio para adoptar."
  };

  it('acepta los datos válidos del formulario', () => {
    expect(solicitudSchema.safeParse(valido).success).toBe(true);
  });

  it.each([
    {
      motivacion: "Breve"
    },
    {
      motivacion: 'x'.repeat(4001)
    },
    {
      postulante: {
        tipoIdentificacion: "RUT",
        identificacion: "12.345.678-9",
        nombre: "Ana Pérez",
        email: "ana@example.test",
        telefono: "+56 9 1234 5678",
        direccion: "Los Aromos 123"
      }
    }
  ])('rechaza datos inválidos %#', cambio => {
    expect(solicitudSchema.safeParse({ ...valido, ...cambio }).success).toBe(false);
  });
});

describe('etapaSchema', () => {
  const valido = {
    accionEtapa: "EVALUAR",
    fechaEtapa: "2026-11-25T12:00",
    resultadoEvalEtapa: "CUMPLE",
    observacionesEtapa: "Cumple los requisitos"
  };

  it('acepta los datos válidos del formulario', () => {
    expect(etapaSchema.safeParse(valido).success).toBe(true);
  });

  it.each([
    {
      fechaEtapa: "2026-02-30T09:00"
    },
    {
      resultadoEvalEtapa: ""
    },
    {
      observacionesEtapa: 'x'.repeat(4001)
    }
  ])('rechaza datos inválidos %#', cambio => {
    expect(etapaSchema.safeParse({ ...valido, ...cambio }).success).toBe(false);
  });
});

describe('seguimientoSchema', () => {
  const valido = {
    accion: "REGISTRAR",
    fecha: "2026-11-25T12:00:00",
    canal: "WHATSAPP",
    estadoAnimal: "En buen estado",
    resultado: "Visita realizada"
  };

  it('acepta los datos válidos del formulario', () => {
    expect(seguimientoSchema.safeParse(valido).success).toBe(true);
  });

  it.each([
    {
      canal: "FAX"
    },
    {
      resultado: 'x'.repeat(101)
    },
    {
      accion: "REPROGRAMAR",
      observaciones: "Sin respuesta",
      fechaReprogramada: "2026-11-25T09:00"
    }
  ])('rechaza datos inválidos %#', cambio => {
    expect(seguimientoSchema.safeParse({ ...valido, ...cambio }).success).toBe(false);
  });
});

describe('devolucionSchema', () => {
  const valido = {
    fecha: "2026-11-25T12:00",
    motivo: "Cambio de domicilio",
    estadoAnimal: "En buen estado"
  };

  it('acepta los datos válidos del formulario', () => {
    expect(devolucionSchema.safeParse(valido).success).toBe(true);
  });

  it.each([
    {
      motivo: "Hola"
    },
    {
      observacionesPostulante: 'x'.repeat(4001)
    }
  ])('rechaza datos inválidos %#', cambio => {
    expect(devolucionSchema.safeParse({ ...valido, ...cambio }).success).toBe(false);
  });
});
