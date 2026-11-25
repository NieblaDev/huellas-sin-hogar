import React, { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Button from '../src/components/ui/Button.jsx';
import Input from '../src/components/ui/Input.jsx';
import Modal from '../src/components/ui/Modal.jsx';
import AnimalFormModal from '../src/components/AnimalFormModal.jsx';
import { loginSchema } from '../src/schemas/auth.schema.js';

function LoginDePrueba({ onSubmit }) {
  const { register, handleSubmit, formState: { errors }, setFocus } = useForm({
    resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' }
  });
  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)}>
      <Input label="Correo" type="email" error={errors.email} {...register('email')} />
      <Input label="Clave" type="password" error={errors.password} {...register('password')} />
      <Button onClick={() => setFocus('email')}>Enfocar correo</Button>
      <Button type="submit">Entrar</Button>
    </form>
  );
}

it('envía datos válidos y enfoca el campo inválido mediante la referencia de RHF', async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn();
  render(<LoginDePrueba onSubmit={onSubmit} />);
  const email = screen.getByLabelText('Correo');
  await user.click(screen.getByRole('button', { name: 'Enfocar correo' }));
  expect(email).toHaveFocus();
  await user.click(screen.getByRole('button', { name: 'Entrar' }));
  expect(await screen.findByText('Ingresa un correo electrónico válido.')).toBeVisible();
  expect(onSubmit).not.toHaveBeenCalled();
  await user.type(email, 'equipo@example.test');
  await user.type(screen.getByLabelText('Clave'), 'prueba123');
  await user.click(screen.getByRole('button', { name: 'Entrar' }));
  expect(onSubmit.mock.calls[0][0]).toEqual({ email: 'equipo@example.test', password: 'prueba123' });
});

it('cierra el diálogo con Escape y devuelve el foco al disparador', async () => {
  function Ejemplo() {
    const [open, setOpen] = useState(false);
    return <>
      <Button onClick={() => setOpen(true)}>Abrir</Button>
      <Modal open={open} onClose={() => setOpen(false)} nombre="Confirmar">
        <Button autoFocus>Cancelar</Button>
      </Modal>
    </>;
  }
  const user = userEvent.setup();
  render(<Ejemplo />);
  const abrir = screen.getByRole('button', { name: 'Abrir' });
  await user.click(abrir);
  const dialogo = screen.getByRole('dialog', { name: 'Confirmar' });
  expect(dialogo).toBeVisible();
  expect(dialogo.closest('.portal-staff').style.backgroundColor).toBe('transparent');
  expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(abrir).toHaveFocus();
});

it('valida la ficha y entrega al componente padre el formulario multipart', async () => {
  const user = userEvent.setup();
  const onGuardar = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 17 }) });
  const onSuccess = vi.fn();
  render(<AnimalFormModal isOpen onGuardar={onGuardar} onSuccess={onSuccess} onClose={vi.fn()} />);

  const guardar = screen.getByRole('button', { name: 'Guardar Ficha del Animal' });
  await user.click(guardar);
  expect(await screen.findByText('Completa este campo.')).toBeVisible();
  expect(onGuardar).not.toHaveBeenCalled();

  const nombre = screen.getByLabelText(/Nombre \/ Identificador/);
  expect(nombre).toHaveFocus();
  await user.type(nombre, 'Luna');
  await user.selectOptions(screen.getByLabelText(/Especie/), 'Gato');
  await user.click(guardar);

  expect(onSuccess).toHaveBeenCalledOnce();
  const [id, payload] = onGuardar.mock.calls[0];
  expect(id).toBeUndefined();
  expect(payload.get('nombre')).toBe('Luna');
  expect(payload.get('especie')).toBe('Gato');
});
