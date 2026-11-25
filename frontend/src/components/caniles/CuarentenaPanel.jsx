import React, { useState } from 'react';
import Button from '../ui/Button';
import CuarentenaBadge from './CuarentenaBadge';
import { asignarCanil, finalizarCuarentena } from '../../services/canil.service';
const fechaEn = n => new Date(Date.now() + n * 86400000).toISOString().slice(0,10);

export default function CuarentenaPanel({ c, user, ejecutar, confirmar }) {
  const [inicio, abrir] = useState(c.estado === 'CUARENTENA'), [motivo, escribir] = useState(''), [observaciones, observar] = useState(''), [fin, fechar] = useState(fechaEn(14));
  if (c.capacidad > 1) return <p>La cuarentena requiere un canil individual. Mueve a los animales a caniles individuales para continuar.</p>;
  if (!c.animales.length) return null;
  if (c.cuarentena) return <section><CuarentenaBadge cuarentena={c.cuarentena}/><p>{c.cuarentena.motivo} · Término estimado {c.cuarentena.fechaFinEstimada.slice(0,10)}</p>
    {['DIRECCION','PERSONAL_VETERINARIO'].includes(user.rol) && <><label>Observaciones al finalizar<textarea value={observaciones} onChange={e => observar(e.target.value)}/></label>
      <Button variante="secundaria" onClick={async () => {
        if (await confirmar({ titulo: 'Finalizar cuarentena', mensaje: c.animales[0].nombre, accion: 'Finalizar' }))
          ejecutar(() => finalizarCuarentena(c.id, { animalId: c.animales[0].id, observaciones }), 'Cuarentena finalizada.');
      }}>Finalizar cuarentena</Button></>}
    </section>;
  return <section>{c.estado === 'CUARENTENA' && <p>Este aislamiento anterior no tiene fecha registrada. Completa el motivo y la fecha de término.</p>}<label><input type="checkbox" checked={inicio} onChange={e => abrir(e.target.checked)}/> En cuarentena</label>
    {inicio && <form onSubmit={e => { e.preventDefault(); ejecutar(() => asignarCanil({ canilId: c.id, animalId: c.animales[0].id, origenEsperadoId: c.id, estado: 'CUARENTENA', motivo, fechaFinEstimada: fin, observaciones })); }}>
      <label>Motivo<input required minLength={5} value={motivo} onChange={e => escribir(e.target.value)}/></label>
      <label>Duración<select defaultValue="14" onChange={e => fechar(fechaEn(Number(e.target.value)))}>{[7,14,21,30].map(n => <option key={n} value={n}>{n} días</option>)}</select></label>
      <label>Fecha de término<input type="date" required min={fechaEn(1)} value={fin} onChange={e => fechar(e.target.value)}/></label>
      <label>Observaciones<textarea value={observaciones} onChange={e => observar(e.target.value)}/></label><Button variante="principal" type="submit">Iniciar cuarentena</Button>
    </form>}</section>;
}
