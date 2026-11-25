import React, { useState } from 'react';
import { ArrowLeftRight, DoorOpen, LogOut, MapPin, X, Trash2 } from 'lucide-react';
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
  const [iniciarMantencion, mostrarMantencion] = useState(false);
  const { confirmar, avisar } = usePortalFeedback();
  const residenteUnico = c.animales.length === 1 ? c.animales[0] : null;
  const enCuarentena = c.estado === 'CUARENTENA';
  const direccion = user.rol === 'DIRECCION';
  async function ejecutar(peticion, mensaje = 'Canil actualizado.') {
    esperar(true); fallo('');
    try {
      const r = await peticion(), data = await r.json();
      if (!r.ok) throw Error(formatearErrorApi(data, 'No se pudo actualizar el canil.'));
      seleccionar(''); mover(null); editar(false); mostrarMantencion(false); avisar(mensaje,'exito');
    } catch (e) { fallo(e.message); }
    finally { await recargar(); esperar(false); }
  }
  const asignar = datos => ejecutar(() => asignarCanil({ canilId: c.id, ...datos }));
  const disponibles = animales.filter(a => !destinoInvalido(a,c,caniles.find(k => k.id === a.canilId)));
  return <Modal nombre={c.nombre} onClose={cerrar} bloqueado={espera} papel={{ className: 'canil-modal canil-ficha' }}>
    <header className="canil-modal-header" data-estado={c.estado}>
      <div className="canil-icono"><DoorOpen size={22}/></div>
      <div className="canil-identidad"><small>Gestión de canil</small><h2>{c.nombre}</h2>
        <div className="canil-chips"><span className="canil-estado">{c.estado}</span>
          <span className="canil-modal-chip"><MapPin size={12}/>{c.sector}</span>
        </div>
      </div>
      <Button className="canil-cerrar" aria-label="Cerrar" onClick={cerrar} disabled={espera}><X size={17}/></Button>
    </header>
    <nav className="canil-nav" aria-label="Detalle del canil">{['Resumen','Animales','Historial'].map(t =>
      <Button aria-pressed={t===tab} key={t} onClick={() => { elegir(t); mover(null); }}>{t}</Button>)}</nav>
    <div className="canil-modal-body">
    {error && <p role="alert" className="portal-alert portal-alert-error">{error}</p>}
    {tab === 'Historial' ? <HistorialCanil id={c.id}/> : <fieldset disabled={espera}>
      <section className="canil-modal-seccion"><div className="canil-seccion-cabecera">
        <h3 className="canil-modal-seccion-titulo">{c.capacidad === 1 ? 'Animal en el canil' : 'Animales en el canil'}</h3>
        <span className="canil-modal-chip">{c.animales.length} / {c.capacidad} cupos</span>
      </div>
      {!c.animales.length && <strong>Canil libre</strong>}
      {c.animales.map(a => <div className="canil-fila" key={a.id}>
        <AnimalPhoto src={a.fotoUrl} className="portal-animal-photo-thumb"/><div className="canil-residente-info"><strong>{a.nombre}</strong><small>{formatearDiasEnCanil(a.diasEnCanil)}</small></div>
        {tab === 'Animales' && <span>{a.especie} · {a.edad} · {a.estadoSalud} · <a href="/animales">Ver ficha</a></span>}
        {tab === 'Animales' && !residenteUnico && <div className="canil-fila-acciones">
          <Button variante="texto" disabled={enCuarentena} aria-label={'Mover a ' + a.nombre} onClick={() => mover(a.id)}>
            <ArrowLeftRight size={14} aria-hidden="true" /> Mover
          </Button>
          <Button variante="texto" disabled={enCuarentena} aria-label={'Retirar a ' + a.nombre + ' del canil'}
            onClick={() => asignar({ animalId: a.id, estado: 'LIBRE' })}>Retirar del canil</Button>
        </div>}
        {moviendo === a.id && <MoverAnimalDialog animal={a} origen={c} caniles={caniles}
          mover={destino => asignar({canilId:destino,animalId:a.id,origenEsperadoId:c.id,estado:'OCUPADO'})}/>}
      </div>)}
      {tab === 'Resumen' && !!c.ocupacion.libres && !['MANTENIMIENTO','CUARENTENA'].includes(c.estado) && <div className="canil-asignacion">
          <AnimalSelect animales={disponibles} value={id} onChange={seleccionar}/><Button className="portal-btn portal-btn-primary" disabled={!id} onClick={() => asignar({ animalId:Number(id), estado:'OCUPADO' })}>Asignar animal</Button></div>}

      </section>
      {tab === 'Resumen' && <>
        <section className="canil-modal-seccion"><div className="canil-seccion-cabecera">
          <div><h3 className="canil-modal-seccion-titulo">Sector del canil</h3><span>{c.sector}</span></div>
        <Button className="portal-btn portal-btn-secondary" onClick={() => editar(!edicion)}>{direccion ? 'Editar canil' : 'Cambiar sector'}</Button></div>
        {edicion && <form className="canil-campos" onSubmit={e => {
          e.preventDefault(); const datos=Object.fromEntries(new FormData(e.currentTarget));
          ejecutar(() => direccion ? actualizarCanil(c.id,{...datos,capacidad:Number(datos.capacidad)}) : actualizarSector(c.id,datos));
        }}><label>Sector<input required maxLength={60} name="sector" defaultValue={c.sector}/></label>
          {direccion && <>
          <label>Capacidad<input type="number" required min={1} max={20} name="capacidad" defaultValue={c.capacidad}/></label>
          </>}
          <Button className="portal-btn portal-btn-primary" type="submit">Guardar cambios</Button></form>}
        </section>

        {(iniciarMantencion || c.estado === 'MANTENIMIENTO') && <section className="canil-modal-seccion">
          <h3 className="canil-modal-seccion-titulo">Mantención</h3>
          {iniciarMantencion ? <form className="canil-campos" onSubmit={e => {
            e.preventDefault();
            const notaMantencion = new FormData(e.currentTarget).get('notaMantencion');
            asignar({ estado: 'MANTENIMIENTO', notaMantencion });
          }}>
            <label className="canil-ancho">Nota de mantención (opcional)
              <textarea name="notaMantencion" rows={3} maxLength={500} defaultValue={c.notaMantencion || ''} autoFocus />
            </label>
            <Button className="portal-btn portal-btn-primary" type="submit">
              {c.estado === 'MANTENIMIENTO' ? 'Guardar nota' : 'Iniciar mantención'}
            </Button>
          </form> : <>
            {c.notaMantencion && <p className="canil-nota">{c.notaMantencion}</p>}
            <Button className="portal-btn portal-btn-secondary" onClick={() => mostrarMantencion(true)}>
              {c.notaMantencion ? 'Editar nota de mantención' : 'Agregar nota de mantención'}
            </Button>
          </>}
        </section>}
        {c.animales.length > 0 && <section className="canil-modal-seccion"><h3 className="canil-modal-seccion-titulo">Cuarentena</h3>
          <CuarentenaPanel c={c} user={user} ejecutar={ejecutar} confirmar={confirmar}/></section>}
      </>}
    </fieldset>}
    </div>
    {(tab === 'Resumen' || (tab === 'Animales' && residenteUnico)) && <footer className="canil-modal-footer">
      <fieldset disabled={espera} className="canil-acciones">
        {residenteUnico && <Button className="portal-btn portal-btn-secondary" disabled={enCuarentena} onClick={() => mover(residenteUnico.id)}>
          <ArrowLeftRight size={16} aria-hidden="true" /> Mover animal
        </Button>}
        {c.animales.length > 0 && <Button className="portal-btn portal-btn-danger" disabled={enCuarentena} onClick={async () => {
          if (c.animales.length === 1 || await confirmar({ titulo:'Liberar canil', mensaje:'Se liberarán ' + c.animales.length + ' animales. ¿Continuar?', accion:'Liberar todos' }))
            asignar({ estado:'LIBRE', confirmarLiberacionMultiple:true });
        }}><LogOut size={16} aria-hidden="true" /> Liberar canil</Button>}
        {!c.animales.length && <Button className="portal-btn portal-btn-secondary" onClick={() => {
          if (iniciarMantencion) mostrarMantencion(false);
          else if (c.estado === 'MANTENIMIENTO') asignar({ estado: 'LIBRE' });
          else mostrarMantencion(true);
        }}>{iniciarMantencion ? 'Cancelar' : c.estado === 'MANTENIMIENTO' ? 'Finalizar mantención' : 'Poner en mantención'}</Button>}
        {!c.animales.length && <Button className="portal-btn portal-btn-danger" onClick={eliminar}><Trash2 size={14}/> Eliminar canil</Button>}
    </fieldset></footer>}
  </Modal>;
}
