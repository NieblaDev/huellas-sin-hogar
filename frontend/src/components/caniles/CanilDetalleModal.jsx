import React, { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import AnimalPhoto from '../AnimalPhoto';
import AnimalSelect from '../AnimalSelect';
import { actualizarCanil, actualizarSector, asignarCanil } from '../../services/canil.service';
import { destinoInvalido } from '../../hooks/useCanilesDragAndDrop';
import { formatearDiasEnCanil } from '../../utils/dias';
import { usePortalFeedback } from '../../context/PortalFeedback';
import { formatearErrorApi } from '../../utils/errores';
import MoverAnimalDialog from './MoverAnimalDialog';
import HistorialCanil from './HistorialCanil';
import CuarentenaPanel from './CuarentenaPanel';

export default function CanilDetalleModal({ c, caniles, animales, user, cerrar, recargar, eliminar }) {
  const [tab, elegir] = useState('Resumen'), [id, seleccionar] = useState(''), [moviendo, mover] = useState(null);
  const [espera, esperar] = useState(false), [error, fallo] = useState('');
  const [edicion, editar] = useState(false);
  const { confirmar, avisar } = usePortalFeedback();
  const direccion = user.rol === 'DIRECCION';
  async function ejecutar(peticion, mensaje = 'Canil actualizado.') {
    esperar(true); fallo('');
    try {
      const r = await peticion(), data = await r.json();
      if (!r.ok) throw Error(formatearErrorApi(data, 'No se pudo actualizar el canil.'));
      seleccionar(''); mover(null); editar(false); avisar(mensaje,'exito');
    } catch (e) { fallo(e.message); }
    finally { await recargar(); esperar(false); }
  }
  const asignar = datos => ejecutar(() => asignarCanil({ canilId: c.id, ...datos }));
  const disponibles = animales.filter(a => !destinoInvalido(a,c,caniles.find(k => k.id === a.canilId)));
  return <Modal nombre={c.nombre} onClose={cerrar} bloqueado={espera} papel={{ className: 'canil-modal canil-ficha' }}>
    <header><h2>{c.codigo} · {c.nombre}</h2><Button onClick={cerrar} disabled={espera}>Cerrar</Button></header>
    <p>{c.sector} · {c.tipo} · {c.estado}</p>
    <nav aria-label="Detalle del canil">{['Resumen','Animales','Historial'].map(t => <Button variante={t===tab?'principal':'secundaria'} key={t} onClick={() => elegir(t)}>{t}</Button>)}</nav>
    {error && <p role="alert">{error}</p>}
    {tab === 'Historial' ? <HistorialCanil id={c.id}/> : <fieldset disabled={espera}>
      <p>Capacidad: {c.capacidad} cupos · {c.animales.length} ocupados</p>{c.notas && <p>{c.notas}</p>}
      {!c.animales.length && <strong>Canil libre</strong>}
      {c.animales.map(a => <section className="canil-fila" key={a.id}>
        <AnimalPhoto src={a.fotoUrl} className="portal-animal-photo-thumb"/><strong>{a.nombre}</strong> · {formatearDiasEnCanil(a.diasEnCanil)}
        {tab === 'Animales' && <span>{a.especie} · {a.edad} · {a.estadoSalud} · <a href="/animales">Ver ficha</a></span>}
        <Button variante="secundaria" disabled={!!c.cuarentena} onClick={() => mover(a.id)}>Mover</Button>
        <Button variante="secundaria" disabled={!!c.cuarentena} onClick={() => asignar({ animalId:a.id, estado:'LIBRE' })}>Liberar</Button>
        {moviendo === a.id && <MoverAnimalDialog animal={a} origen={c} caniles={caniles}
          mover={destino => asignar({canilId:destino,animalId:a.id,origenEsperadoId:c.id,estado:'OCUPADO'})}/>}
      </section>)}
      {tab === 'Resumen' && <>
        {!!c.ocupacion.libres && !['MANTENIMIENTO','CUARENTENA'].includes(c.estado) && <div>
          <AnimalSelect animales={disponibles} value={id} onChange={seleccionar}/><Button variante="principal" disabled={!id} onClick={() => asignar({ animalId:Number(id), estado:'OCUPADO' })}>Asignar animal</Button></div>}
        <CuarentenaPanel c={c} user={user} ejecutar={ejecutar} confirmar={confirmar}/>
        {c.animales.length > 0 && <Button variante="secundaria" disabled={!!c.cuarentena} onClick={async () => {
          if (c.animales.length === 1 || await confirmar({ titulo:'Liberar canil', mensaje:'Se liberarán ' + c.animales.length + ' animales. ¿Continuar?', accion:'Liberar todos' }))
            asignar({ estado:'LIBRE', confirmarLiberacionMultiple:true });
        }}>Liberar canil</Button>}
        {!c.animales.length && <Button variante="secundaria" onClick={() => asignar({ estado:c.estado === 'MANTENIMIENTO' ? 'LIBRE' : 'MANTENIMIENTO' })}>{c.estado === 'MANTENIMIENTO' ? 'Finalizar mantenimiento' : 'Poner en mantenimiento'}</Button>}
        <Button variante="secundaria" onClick={() => editar(!edicion)}>{direccion ? 'Editar canil' : 'Cambiar sector'}</Button>
        {edicion && <form onSubmit={e => {
          e.preventDefault(); const datos=Object.fromEntries(new FormData(e.currentTarget));
          ejecutar(() => direccion ? actualizarCanil(c.id,{...datos,capacidad:Number(datos.capacidad)}) : actualizarSector(c.id,datos));
        }}><label>Sector<input required maxLength={60} name="sector" defaultValue={c.sector}/></label>
          {direccion && <><label>Tipo<select name="tipo" defaultValue={c.tipo}>{['Mixto','Perro','Gato'].map(x => <option key={x}>{x}</option>)}</select></label>
          <label>Capacidad<input type="number" required min={1} max={20} name="capacidad" defaultValue={c.capacidad}/></label>
          <label>Notas<textarea name="notas" maxLength={500} defaultValue={c.notas}/></label></>}
          <Button variante="principal" type="submit">Guardar cambios</Button></form>}
        {!c.animales.length && <Button onClick={eliminar}>Eliminar canil</Button>}
      </>}
    </fieldset>}
  </Modal>;
}
