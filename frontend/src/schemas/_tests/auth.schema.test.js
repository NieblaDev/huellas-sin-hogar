import { describe, expect, it } from 'vitest';
import { loginSchema } from '../auth.schema.js';

describe('loginSchema', () => {
  const valido = {
    email: "equipo@example.test",
    password: "abc123"
  };

  it('acepta los datos válidos del formulario', () => {
    expect(loginSchema.safeParse(valido).success).toBe(true);
  });

  it.each([
    {
      email: "equipo"
    },
    {
      password: "xxxxx"
    }
  ])('rechaza datos inválidos %#', cambio => {
    expect(loginSchema.safeParse({ ...valido, ...cambio }).success).toBe(false);
  });
});
