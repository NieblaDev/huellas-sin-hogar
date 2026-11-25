import React from 'react';
import AnimalPhoto from '../AnimalPhoto';

export default function CanilGrupoAvatarStack({ animales }) {
  return <div className="canil-avatares">
    {animales.slice(0,3).map(a => <AnimalPhoto key={a.id} src={a.fotoUrl} className="portal-animal-photo-thumb"/>)}
    {animales.length > 3 && <b>+{animales.length-3}</b>}
    <span>{animales.length} animales</span>
  </div>;
}
