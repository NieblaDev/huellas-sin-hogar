import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { expect,it,vi } from 'vitest';
import { CanilCard, QrEtiquetasModal } from '../src/pages/CanilesPage.jsx';
import { destinoInvalido } from '../src/hooks/useCanilesDragAndDrop';
import { formatearDiasEnCanil,diasRestantesCuarentena } from '../src/utils/dias';
import { urlCanil } from '../src/utils/qr';
const animales=['Mora','Luna','Lila'].map((nombre,i)=>({id:i+1,nombre,activo:true,especie:'Perro',edad:'2 años',estadoSalud:'NORMAL',diasEnCanil:i}));
const c={id:1,codigo:'C-01',nombre:'Camada',sector:'Patio',tipo:'Perro',estado:'OCUPADO',capacidad:4,ocupacion:{libres:1},animales};
it('calcula días y URLs públicas',()=>{
  expect([null,0,1,9].map(formatearDiasEnCanil)).toEqual(['—','Ingresó hoy','1 día','9 días']);
  expect(diasRestantesCuarentena('2026-11-24',new Date('2026-11-25T23:59Z'))).toBe(-1);
  vi.stubEnv('VITE_PUBLIC_APP_URL','https://refugio.example/');
  expect(urlCanil(1)).toBe('https://refugio.example/caniles/1');
  vi.stubEnv('VITE_PUBLIC_APP_URL','');
  expect(urlCanil(1)).toBe(location.origin+'/caniles/1'); vi.unstubAllEnvs();
});
it('valida destinos del mapa',()=>{
  expect(destinoInvalido(animales[0], { ...c, tipo: 'Gato' })).toBe('');
  expect(destinoInvalido({ id: 20, especie: 'Gato' }, c, null, { ampliarCapacidad: true }))
    .toBe('Perros y gatos deben alojarse en caniles separados.');
  for (const cambio of [{estado:'MANTENIMIENTO'},{estado:'CUARENTENA'},{ocupacion:{libres:0}}])
    expect(destinoInvalido(animales[0],{...c,...cambio})).toBeTruthy();
});
it('muestra cupos y datos del animal en la tarjeta grupal',()=>{
  render(<CanilCard canil={c} abrir={()=>{}}/>);
  expect(screen.getByText('3 / 4')).toBeVisible();
  const mora = within(screen.getByRole('button', { name: 'Mover a Mora' }));
  expect(mora.getByText('Mora')).toBeVisible();
  expect(mora.getByText('Perro · 2 años · Normal')).toBeVisible();
  expect(mora.queryByText('Ingresó hoy')).not.toBeInTheDocument();
});
it('muestra solo el nombre numerado del canil y el QR en la vista previa y la impresión', async () => {
  const canil = { ...c, nombre: 'Canil 1' };
  render(<QrEtiquetasModal todos={[canil]} sector={[canil]} filtrados={[canil]} cerrar={()=>{}}/>);
  const dialog=within(screen.getByRole('dialog'));
  expect(await dialog.findByAltText('QR de Canil 1')).toHaveAttribute('src', expect.stringContaining('image/svg+xml'));
  const etiquetas = document.querySelectorAll('.qr-etiqueta');
  expect(etiquetas).toHaveLength(2);
  for (const etiqueta of etiquetas) {
    expect(etiqueta.textContent).toBe('Canil 1');
    expect(etiqueta.querySelector('img')).toHaveAttribute('alt', 'QR de Canil 1');
  }
});
