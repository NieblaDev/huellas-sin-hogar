import React from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import AnimalPhoto from '../AnimalPhoto';
import CanilGrupoAvatarStack from './CanilGrupoAvatarStack';
import CuarentenaBadge from './CuarentenaBadge';
import { formatearDiasEnCanil, DIAS_ESTADIA_PROLONGADA } from '../../utils/dias';

function Residente({ animal, origen, bloqueado }) {
  const drag = useDraggable({ id: 'animal-' + animal.id, data: { animal, origen },
    disabled: bloqueado || !animal.activo || animal.estadoAdopcion === 'ADOPTADO' || origen.estado === 'CUARENTENA' });
  return <button type="button" className="canil-residente" ref={drag.setNodeRef} {...drag.attributes} {...drag.listeners}
    aria-label={'Mover a ' + animal.nombre} onClick={() => document.getElementById('abrir-canil-' + origen.id)?.click()}>
    {origen.capacidad === 1 && <AnimalPhoto src={animal.fotoUrl} className="portal-animal-photo-thumb"/>}
    <span>{animal.nombre} · {formatearDiasEnCanil(animal.diasEnCanil)}</span>
    {animal.diasEnCanil >= DIAS_ESTADIA_PROLONGADA && <small title="Al menos 30 días en este canil">Estadía prolongada</small>}
  </button>;
}
export default function CanilCard({ canil, abrir, bloqueado, resaltado }) {
  const { setNodeRef, isOver } = useDroppable({ id: canil.id, data: { nombre: canil.nombre }, disabled: bloqueado });
  const animales = canil.animales;
  return <article ref={setNodeRef} className={'canil-tarjeta ' + (isOver || resaltado ? 'canil-resaltado' : '')} title={[canil.tipo,canil.notas].filter(Boolean).join(' · ')}>
    <button className="canil-abrir" id={'abrir-canil-' + canil.id} onClick={() => abrir(canil)}
      aria-label={[canil.nombre,canil.estado, animales.length + ' de ' + canil.capacidad, ...animales.map(a => a.nombre)].join(', ')}>
      <strong>{canil.nombre}</strong><small>{canil.estado}</small></button>
    <p>{canil.codigo} · {canil.sector} · {canil.tipo}</p>
    {canil.capacidad > 1 && <><strong>{animales.length} / {canil.capacidad}</strong><progress value={animales.length} max={canil.capacidad}/>
      <CanilGrupoAvatarStack animales={animales}/></>}
    {animales.length ? animales.map(a => <Residente key={a.id} animal={a} origen={canil} bloqueado={bloqueado}/>) : <p>Canil libre</p>}
    {animales.length > 1 && <small>Más antiguo: {formatearDiasEnCanil(Math.max(...animales.map(a => a.diasEnCanil)))}</small>}
    <CuarentenaBadge cuarentena={canil.cuarentena}/>
  </article>;
}
