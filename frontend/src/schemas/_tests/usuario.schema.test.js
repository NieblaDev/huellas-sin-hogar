import { describe, expect, it } from 'vitest';
import { perfilSchema, editarSexoSchema } from '../usuario.schema.js';

describe('perfilSchema', () => {
  const valido = {
    nombre: "Perfil de prueba",
    email: "perfil@example.test",
    sexo: "NEUTRO",
    rol: "VOLUNTARIO_NOVATO",
    password: "paso1234",
    confirmar: "paso1234"
  };

  it('acepta los datos válidos del formulario', () => {
    expect(perfilSchema.safeParse(valido).success).toBe(true);
  });

  it.each([
    {
      nombre: 'x'.repeat(101)
    },
    {
      email: "incorrecto"
    },
    {
      password: "xxxxxxxx"
    },
    {
      password: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1"
    },
    {
      confirmar: "nueva123"
    }
  ])('rechaza datos inválidos %#', cambio => {
    expect(perfilSchema.safeParse({ ...valido, ...cambio }).success).toBe(false);
  });
});

describe('editarSexoSchema', () => {
  const valido = {
    sexoEditado: "FEMENINO"
  };

  it('acepta los datos válidos del formulario', () => {
    expect(editarSexoSchema.safeParse(valido).success).toBe(true);
  });

  it.each([
    {
      sexoEditado: 'X'
    }
  ])('rechaza datos inválidos %#', cambio => {
    expect(editarSexoSchema.safeParse({ ...valido, ...cambio }).success).toBe(false);
  });
});
