import React from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { DoorOpen, Wrench } from 'lucide-react';
import AnimalPhoto from '../AnimalPhoto';
import CanilGrupoAvatarStack from './CanilGrupoAvatarStack';
import CuarentenaBadge from './CuarentenaBadge';
import { formatearDiasEnCanil, DIAS_ESTADIA_PROLONGADA } from '../../utils/dias';

function Residente({ animal, origen, bloqueado }) {
  const drag = useDraggable({ id: 'animal-' + animal.id, data: { animal, origen },
    disabled: bloqueado || !animal.activo || animal.estadoAdopcion === 'ADOPTADO' || origen.estado === 'CUARENTENA' });
  return <button type="button" className="portal-canil-resident canil-residente" ref={drag.setNodeRef} {...drag.attributes} {...drag.listeners}
    aria-label={'Mover a ' + animal.nombre} onClick={() => document.getElementById('abrir-canil-' + origen.id)?.click()}>
    {origen.capacidad === 1 && <AnimalPhoto src={animal.fotoUrl} className="portal-animal-photo-thumb"/>}
    <span className="canil-residente-info"><span>{animal.nombre} · {formatearDiasEnCanil(animal.diasEnCanil)}</span>
      {origen.capacidad === 1 && <small>{[animal.especie, animal.sexo, { NORMAL: 'Normal', CONDICION_ESPECIAL: 'Condición especial', CRITICO: 'Crítico' }[animal.estadoSalud]].filter(Boolean).join(' · ')}</small>}</span>
    {animal.diasEnCanil >= DIAS_ESTADIA_PROLONGADA && <small title="Al menos 30 días en este canil">Estadía prolongada</small>}
  </button>;
}
export default function CanilCard({ canil, abrir, bloqueado, resaltado }) {
  const { setNodeRef, isOver } = useDroppable({ id: canil.id, data: { nombre: canil.nombre }, disabled: bloqueado });
  const animales = canil.animales;
  return <article ref={setNodeRef} data-estado={canil.estado} className={'portal-card-selectable canil-tarjeta ' + (isOver || resaltado ? 'canil-resaltado' : '')}>
    <button className="canil-abrir" id={'abrir-canil-' + canil.id} onClick={() => abrir(canil)}
      aria-label={[canil.nombre,canil.estado, animales.length + ' de ' + canil.capacidad, ...animales.map(a => a.nombre)].join(', ')}>
      <strong>{canil.nombre}</strong><span className="canil-estado">{canil.estado}</span></button>
    <p className="canil-sector">Sector: <strong>{canil.sector}</strong></p>
    {canil.capacidad > 1 && <><strong>{animales.length} / {canil.capacidad}</strong><progress value={animales.length} max={canil.capacidad}/>
      <CanilGrupoAvatarStack animales={animales}/></>}
    {animales.length ? animales.map(a => <Residente key={a.id} animal={a} origen={canil} bloqueado={bloqueado}/>) : <div className="canil-vacio">{canil.estado === 'MANTENIMIENTO' ? <><Wrench size={16}/> En mantenimiento</> : <><DoorOpen size={16}/> Canil disponible</>}</div>}
    {animales.length > 1 && <small>Más antiguo: {formatearDiasEnCanil(Math.max(...animales.map(a => a.diasEnCanil)))}</small>}
    <CuarentenaBadge cuarentena={canil.cuarentena}/>
  </article>;
}
