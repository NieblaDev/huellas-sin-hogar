import { describe, expect, it } from 'vitest';
import { reporteSchema } from '../reporte.schema.js';

describe('reporteSchema', () => {
  const valido = {
    formato: "CSV",
    tipoInformacion: "TODOS"
  };

  it('acepta los datos válidos del formulario', () => {
    expect(reporteSchema.safeParse(valido).success).toBe(true);
  });

  it.each([
    {
      formato: "XLS"
    },
    {
      fechaDesde: "2026-11-30",
      fechaHasta: "2026-11-25"
    },
    {
      fechaDesde: "2026-13-01"
    }
  ])('rechaza datos inválidos %#', cambio => {
    expect(reporteSchema.safeParse({ ...valido, ...cambio }).success).toBe(false);
  });
});
