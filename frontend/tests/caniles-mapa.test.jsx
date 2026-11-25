import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { expect,it,vi } from 'vitest';
import CanilCard from '../src/components/caniles/CanilCard';
import QrEtiquetasModal from '../src/components/caniles/QrEtiquetasModal';
import { destinoInvalido } from '../src/hooks/useCanilesDragAndDrop';
import { formatearDiasEnCanil,diasRestantesCuarentena } from '../src/utils/dias';
import { urlCanil } from '../src/utils/qr';
const animales=['Mora','Luna','Lila'].map((nombre,i)=>({id:i+1,nombre,activo:true,especie:'Perro',diasEnCanil:i}));
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
  expect(destinoInvalido(animales[0],c)).toBe('');
  for (const cambio of [{estado:'MANTENIMIENTO'},{estado:'CUARENTENA'},{ocupacion:{libres:0}},{tipo:'Gato'}])
    expect(destinoInvalido(animales[0],{...c,...cambio})).toBeTruthy();
});
it('muestra cupos, nombres y días en la tarjeta grupal',()=>{
  render(<CanilCard canil={c} abrir={()=>{}}/>);
  expect(screen.getByText('3 / 4')).toBeVisible();
  expect(screen.getByText('Mora · Ingresó hoy')).toBeVisible();
});
it('genera una etiqueta por canil con los nombres y QR',async ()=>{
  render(<QrEtiquetasModal todos={[c]} sector={[c]} filtrados={[c]} cerrar={()=>{}}/>);
  const dialog=within(screen.getByRole('dialog'));
  expect(dialog.getByText('Ocupa: Mora, Luna, Lila')).toBeVisible();
  expect(await dialog.findByAltText('QR de Camada')).toHaveAttribute('src',expect.stringContaining('image/svg+xml'));
  expect(document.querySelectorAll('.qr-print-area .qr-etiqueta')).toHaveLength(1);
});
