import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import PortalFeedback from '../src/context/PortalFeedback.jsx';
import CanilesPage from '../src/pages/CanilesPage.jsx';
import { listarAnimales } from '../src/services/animal.service.js';
import { listarCaniles, listarTraslados } from '../src/services/canil.service.js';

vi.mock('../src/services/animal.service.js');
vi.mock('../src/services/canil.service.js');

it('muestra los movimientos internos y los traslados externos en bitácoras distintas', async () => {
  listarCaniles.mockResolvedValue({ ok: true, json: async () => ({ caniles: [] }) });
  listarAnimales.mockResolvedValue({ ok: true, json: async () => [] });
  listarTraslados.mockResolvedValue({
    ok: true,
    json: async () => [
      {
        id: 1,
        tipo: 'INTERNO_CANIL',
        estado: 'COMPLETADO',
        animal: { nombre: 'Luna' },
        canilOrigen: { nombre: 'Canil 1' },
        canilDestino: { nombre: 'Canil 2' }
      },
      {
        id: 2,
        tipo: 'PROTECTORA_ALIADA',
        estado: 'PENDIENTE_APROBACION',
        animal: { nombre: 'Toby' },
        destinoNombre: 'Protectora Patitas'
      },
      {
        id: 3,
        tipo: 'HOGAR_TEMPORAL',
        estado: 'APROBADO',
        animal: { nombre: 'Mora' },
        destinoNombre: 'Familia Morales'
      }
    ]
  });

  const user = userEvent.setup();
  render(
    <PortalFeedback>
      <CanilesPage user={{ rol: 'DIRECCION' }} />
    </PortalFeedback>
  );

  await user.click(screen.getByRole('button', { name: 'Movimientos de Caniles' }));
  const movimientos = within(screen.getByRole('table', { name: 'Bitácora de Movimientos de Caniles' }));
  expect(await movimientos.findByText('Luna')).toBeVisible();
  expect(movimientos.getByText('Canil 1 → Canil 2')).toBeVisible();
  expect(movimientos.queryByText('Toby')).not.toBeInTheDocument();
  expect(movimientos.queryByText('Mora')).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Traslados Externos' }));
  const externos = within(screen.getByRole('table', { name: 'Bitácora de Traslados Externos' }));
  expect(externos.getByText('Toby')).toBeVisible();
  expect(externos.getByText('Mora')).toBeVisible();
  expect(externos.getByRole('button', { name: /Revisar/ })).toBeVisible();
  expect(externos.queryByText('Luna')).not.toBeInTheDocument();
});
