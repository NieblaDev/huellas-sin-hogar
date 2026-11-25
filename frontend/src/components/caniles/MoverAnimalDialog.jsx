import React from 'react';
import Input from '../ui/Input';
import { destinoInvalido } from '../../hooks/useCanilesDragAndDrop';

export default function MoverAnimalDialog({ animal, origen, caniles, mover }) {
  const destinos = caniles.filter(c => !destinoInvalido(animal, c, origen));
  return <label>Destino para {animal.nombre}
    <Input as="select" autoFocus defaultValue="" onChange={e => e.target.value && mover(Number(e.target.value))}>
      <option value="">{destinos.length ? 'Seleccionar destino' : 'Sin destinos disponibles'}</option>
      {destinos.map(c => <option key={c.id} value={c.id}>{c.nombre} · {c.sector}</option>)}
    </Input>
  </label>;
}
