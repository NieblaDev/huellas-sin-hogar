import { DndContext, DragOverlay, closestCenter, pointerWithin, useDraggable, useDroppable } from '@dnd-kit/core';
import { useNavigate, useParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { destinoInvalido, useCanilesDragAndDrop, accesibilidadArrastre } from '../hooks/useCanilesDragAndDrop';
import '../styles/caniles.css';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import useLecturasNotificaciones from '../hooks/useLecturasNotificaciones.js';
import Input from '../components/ui/Input.jsx';
import Modal from '../components/ui/Modal.jsx';
import useFormulario from '../hooks/useFormulario.js';
import { aprobacionTrasladoSchema, crearCanilSchema, trasladoSchema } from '../schemas/canil.schema.js';
import ErrorCampo from '../components/ui/ErrorCampo.jsx';
import { usePortalFeedback } from '../context/PortalFeedback.jsx';
import AnimalPhoto from '../components/AnimalPhoto';
import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeftRight,
  Bell,
  ChartColumn,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  Clock,
  DoorOpen,
  FileText,
  LogOut,
  Map,
  MapPin,
  PawPrint,
  Plus,
  QrCode,
  Send,
  Search,
  ShieldCheck,
  Siren,
  Trash2,
  TrendingUp,
  TriangleAlert,
  Wrench,
  X
} from 'lucide-react';
import { actualizarCanil, actualizarSector, asignarCanil, crearCanil, finalizarCuarentena, eliminarCanil as eliminarCanilApi, listarCaniles, listarTraslados, resolverTraslado, solicitarTraslado } from '../services/canil.service.js';
import { listarAnimales } from '../services/animal.service.js';
import AnimalSelect from '../components/AnimalSelect';
import { resumirAnimalEnCanil } from '../utils/condicionAnimal';
import { formatearErrorApi } from '../utils/errores';
import { DIAS_ESTADIA_PROLONGADA, diasRestantesCuarentena, formatearDiasEnCanil } from '../utils/dias';
import { mezclaPerrosYGatos } from '../utils/especiesCanil.js';
import { imagenQr, urlCanil } from '../utils/qr';

const ETIQUETAS_TIPO_TRASLADO = {
  INTERNO_CANIL: 'Movimiento interno entre caniles',
  PROTECTORA_ALIADA: 'Traslado a protectora aliada',
  HOGAR_TEMPORAL: 'Traslado a hogar temporal'
};

const ESTADOS_TRASLADO = {
  COMPLETADO: { etiqueta: 'Completado', bg: 'var(--portal-primary-soft)', color: 'var(--portal-primary-dark)' },
  APROBADO: { etiqueta: 'Aprobado', bg: 'var(--portal-primary-soft)', color: 'var(--portal-primary-dark)' },
  PENDIENTE_APROBACION: { etiqueta: 'Pendiente de aprobación', bg: '#fff0ca', color: '#895100' },
  RECHAZADO: { etiqueta: 'Rechazado', bg: '#ffe4e6', color: '#b82d44' }
};

const formatearFecha = (fecha, incluirHora = false) => {
  if (!fecha) return '—';
  const valor = new Date(fecha);
  if (Number.isNaN(valor.getTime())) return '—';

  return incluirHora
    ? valor.toLocaleString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : valor.toLocaleDateString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
};

const normalizarBusqueda = texto => texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

function textoCuarentena(q) {
  const n = diasRestantesCuarentena(q.fechaFinEstimada);
  if (n < 0) return 'Cuarentena vencida hace ' + Math.abs(n) + (n === -1 ? ' día' : ' días');
  return 'Cuarentena · ' + (n === 0 ? 'vence hoy' : n === 1 ? 'vence mañana' : 'quedan ' + n + ' días');
}
function CuarentenaBadge({ cuarentena }) {
  return cuarentena && <strong className="canil-cuarentena">{textoCuarentena(cuarentena)}</strong>;
}

function CanilGrupoAvatarStack({ animales, capacidad }) {
  return <div className="canil-avatares">
    <strong>{animales.length} / {capacidad}</strong>
    {/* {animales.slice(0,3).map(a => <AnimalPhoto key={a.id} src={a.fotoUrl} className="portal-animal-photo-thumb"/>)}
    {animales.length > 3 && <b>+{animales.length-3}</b>} */}
    <span>animales</span>
  </div>;
}

function Residente({ animal, origen, bloqueado }) {
  const drag = useDraggable({ id: 'animal-' + animal.id, data: { animal, origen },
    disabled: bloqueado || !animal.activo || animal.estadoAdopcion === 'ADOPTADO' || origen?.estado === 'CUARENTENA' });
  return <button type="button" className="portal-canil-resident canil-residente" ref={drag.setNodeRef} {...drag.attributes} {...drag.listeners}
    aria-label={(origen ? 'Mover a ' : 'Arrastrar a ') + animal.nombre}
    onClick={origen ? () => document.getElementById('abrir-canil-' + origen.id)?.click() : undefined}>
    <AnimalPhoto src={animal.fotoUrl} className="portal-animal-photo-thumb"/>
    <span className="canil-residente-info">
      <span>{animal.nombre}</span>
      <small>{resumirAnimalEnCanil(animal)}</small>
    </span>
  </button>;
}
const DESTINO_SIN_CANIL = 'animales-sin-canil';

function AnimalesSinCanil({ animales, retraido, cambiar, bloqueado }) {
  const { setNodeRef, isOver } = useDroppable({
    id: DESTINO_SIN_CANIL, data: { nombre: 'Animales sin canil', sinCanil: true }, disabled: bloqueado
  });
  return (
    <aside ref={setNodeRef} className={`canil-dock${isOver ? ' canil-dock-destino' : ''}`} aria-label="Animales sin canil">
      <div className="canil-dock-header">
        {!retraido && <>
          <PawPrint size={19} aria-hidden="true" />
          <h3>Animales sin canil</h3>
          <span className="canil-modal-chip" aria-label={animales.length + ' animales sin canil'}>{animales.length}</span>
        </>}
        <Button key="plegar-panel" className={retraido ? 'portal-btn portal-btn-secondary canil-dock-expandir' : 'canil-dock-toggle'}
          aria-expanded={!retraido} aria-controls="canil-dock-lista" onClick={cambiar}
          aria-label={retraido ? 'Expandir animales sin canil (' + animales.length + ')' : 'Plegar animales sin canil'}>
          {retraido ? <>
            <PawPrint size={19} aria-hidden="true" />
            <span>Sin canil</span>
            <span className="canil-modal-chip">{animales.length}</span>
            <ChevronRight size={16} aria-hidden="true" />
          </> : <>
            <ChevronLeft size={18} aria-hidden="true" />
          </>}
        </Button>
      </div>
      <div id="canil-dock-lista" className="canil-dock-cuerpo" hidden={retraido}>
        {animales.length ? <>
          <p>Arrastra un animal al mapa para asignarlo.</p>
          <ul className="canil-dock-lista">
            {animales.map(animal => <li key={animal.id}>
              <Residente animal={animal} origen={null} bloqueado={bloqueado} />
            </li>)}
          </ul>
        </> : <p>Todos los animales están asignados a un canil.</p>}
      </div>
    </aside>
  );
}

export function CanilCard({ canil, abrir, bloqueado, resaltado }) {
  const { setNodeRef, isOver } = useDroppable({ id: canil.id, data: { nombre: canil.nombre }, disabled: bloqueado });
  const animales = canil.animales;
  return <article ref={setNodeRef} data-estado={canil.estado} className={'portal-card-selectable canil-tarjeta ' + (isOver || resaltado ? 'canil-resaltado' : '')}>
    <button className="canil-abrir" id={'abrir-canil-' + canil.id} onClick={() => abrir(canil)}
      aria-label={[canil.nombre,canil.estado, animales.length + ' de ' + canil.capacidad, ...animales.map(a => a.nombre)].join(', ')}>
      <strong>{canil.nombre}</strong><span className="canil-estado">{canil.estado}</span></button>
    <p className="canil-sector">Sector: <strong>{canil.sector}</strong></p>
    {canil.capacidad > 1 && <><CanilGrupoAvatarStack animales={animales} capacidad={canil.capacidad}/></>}
    {animales.length ? (
      <div className={animales.length > 1 ? 'canil-residentes-grupo' : undefined}
        role={animales.length > 1 ? 'group' : undefined}
        aria-label={animales.length > 1 ? 'Residentes del canil, en una fila desplazable' : undefined}>
        {animales.map(animal => <Residente key={animal.id} animal={animal} origen={canil} bloqueado={bloqueado} />)}
      </div>
    ) : <div className="canil-vacio">{canil.estado === 'MANTENIMIENTO' ? <><Wrench size={16}/> En mantenimiento</> : <><DoorOpen size={16}/> Canil disponible</>}</div>}
    {mezclaPerrosYGatos(animales) && <span className="canil-cuarentena">Perros y gatos por separar</span>}
    <CuarentenaBadge cuarentena={canil.cuarentena}/>
  </article>;
}

const fechaEn = n => new Date(Date.now() + n * 86400000).toISOString().slice(0,10);

function CuarentenaPanel({ c, user, ejecutar, confirmar }) {
  const [inicio, abrir] = useState(c.estado === 'CUARENTENA'), [motivo, escribir] = useState(''), [observaciones, observar] = useState(''), [fin, fechar] = useState(fechaEn(14));
  const [notaCierre, escribirNotaCierre] = useState('');
  if (c.capacidad > 1) return <p>La cuarentena requiere un canil individual. Mueve a los animales a caniles individuales para continuar.</p>;
  if (!c.animales.length) return null;
  if (c.cuarentena) return <section><CuarentenaBadge cuarentena={c.cuarentena}/><p>{c.cuarentena.motivo} · Término estimado {c.cuarentena.fechaFinEstimada.slice(0,10)}</p>
    {c.cuarentena.observaciones && <p className="canil-nota">{c.cuarentena.observaciones}</p>}
    {['DIRECCION','PERSONAL_VETERINARIO'].includes(user.rol) && <><label>Nota de cierre (opcional)<textarea maxLength={4000} value={notaCierre} onChange={e => escribirNotaCierre(e.target.value)}/></label>
      <Button className="portal-btn portal-btn-secondary" onClick={async () => {
        if (await confirmar({ titulo: 'Finalizar cuarentena', mensaje: c.animales[0].nombre, accion: 'Finalizar' }))
          ejecutar(() => finalizarCuarentena(c.id, { animalId: c.animales[0].id, observaciones: notaCierre.trim() || null }), 'Cuarentena finalizada.');
      }}>Finalizar cuarentena</Button></>}
    </section>;
  return <section>{c.estado === 'CUARENTENA' && <p>Este aislamiento anterior no tiene fecha registrada. Completa el motivo y la fecha de término.</p>}<label className="canil-cuarentena-control canil-cuarentena-label"><span>En cuarentena</span><input className="canil-cuarentena-checkbox" type="checkbox" checked={inicio} onChange={e => abrir(e.target.checked)}/></label>
    {inicio && <form className="canil-campos" onSubmit={e => { e.preventDefault(); ejecutar(() => asignarCanil({ canilId: c.id, animalId: c.animales[0].id, origenEsperadoId: c.id, estado: 'CUARENTENA', motivo, fechaFinEstimada: fin, observaciones: observaciones.trim() || null })); }}>
      <label>Motivo<input required minLength={5} value={motivo} onChange={e => escribir(e.target.value)}/></label>
      <label>Duración<select defaultValue="14" onChange={e => fechar(fechaEn(Number(e.target.value)))}>{[7,14,21,30].map(n => <option key={n} value={n}>{n} días</option>)}</select></label>
      <label>Fecha de término<input type="date" required min={fechaEn(1)} value={fin} onChange={e => fechar(e.target.value)}/></label>
      <label>Nota de cuarentena (opcional)<textarea maxLength={4000} value={observaciones} onChange={e => observar(e.target.value)}/></label><Button className="portal-btn portal-btn-primary" type="submit">Iniciar cuarentena</Button>
    </form>}</section>;
}

function MoverAnimalDialog({ animal, origen, caniles, mover }) {
  const destinos = caniles.filter(c => !destinoInvalido(animal, c, origen));
  return <label>Destino para {animal.nombre}
    <Input as="select" autoFocus defaultValue="" onChange={e => e.target.value && mover(Number(e.target.value))}>
      <option value="">{destinos.length ? 'Seleccionar destino' : 'Sin destinos disponibles'}</option>
      {destinos.map(c => <option key={c.id} value={c.id}>{c.nombre} · {c.sector}</option>)}
    </Input>
  </label>;
}

function SelectorSectorCanil({ sectores, sectorInicial = '', onChange, error }) {
  const [opcion, seleccionar] = useState(sectorInicial);
  const crearSector = opcion === '';
  return (
    <div className="canil-selector-sector">
      <Input as="select" label="Sector" className="portal-select" name={crearSector ? undefined : 'sector'}
        value={opcion} error={crearSector ? undefined : error} onChange={e => {
          seleccionar(e.target.value);
          onChange?.(e.target.value);
        }}>
        <option value="">— Crear un nuevo sector —</option>
        {sectores.map(sector => <option key={sector} value={sector}>{sector}</option>)}
      </Input>
      {crearSector && <Input as="input" label="Nuevo sector" className="portal-input" name="sector"
        required maxLength={60} placeholder="Ej: Patio Principal" error={error}
        onChange={e => onChange?.(e.target.value)} />}
    </div>
  );
}

function CanilDetalleModal({ c, caniles, sectores, animales, user, cerrar, recargar, eliminar }) {
  const navegar = useNavigate();
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
  const enAnimales = tab === 'Animales';
  const cuposLibres = c.ocupacion.libres;
  const puedeAmpliar = enAnimales && c.capacidad < 20;
  const mostrarSelector = !['MANTENIMIENTO', 'CUARENTENA'].includes(c.estado) && (cuposLibres > 0 || puedeAmpliar);
  const disponibles = animales.filter(animal => !destinoInvalido(
    animal, c, caniles.find(canil => canil.id === animal.canilId), { ampliarCapacidad: puedeAmpliar }
  ));
  const seleccionado = disponibles.find(animal => String(animal.id) === id);
  return <Modal nombre={c.nombre} onClose={cerrar} bloqueado={espera} papel={{ className: 'canil-modal canil-ficha' }}>
    <header className="canil-modal-header" data-estado={c.estado}>
      <div className="canil-icono"><DoorOpen size={22}/></div>
      <div className="canil-identidad"><small>Gestión de canil</small><h2>{c.nombre}</h2>
        <div className="canil-chips"><span className="canil-estado" style={{ marginRight: '12px' }}>{c.estado}</span>
          <span className="canil-modal-chip"><MapPin size={12}/>{c.sector}</span>
        </div>
      </div>
      <Button className="canil-cerrar" aria-label="Cerrar" onClick={cerrar} disabled={espera}><X size={17}/></Button>
    </header>
    <nav className="canil-nav" aria-label="Detalle del canil">{['Resumen','Animales'].map(t =>
      <Button aria-pressed={t===tab} key={t} onClick={() => { elegir(t); mover(null); seleccionar(''); }}>{t}</Button>)}</nav>
    <div className="canil-modal-body">
    {error && <p role="alert" className="portal-alert portal-alert-error">{error}</p>}
    <fieldset disabled={espera}>
      <section className="canil-modal-seccion"><div className="canil-seccion-cabecera">
        <h3 className="canil-modal-seccion-titulo">{c.capacidad === 1 ? 'Animal en el canil' : 'Animales en el canil'}</h3>
        <span className="canil-modal-chip">{c.animales.length} / {c.capacidad} cupos</span>
      </div>
      {!c.animales.length && <strong>Canil libre</strong>}
      {c.animales.map(a => <div className="canil-fila" key={a.id}>
        <AnimalPhoto src={a.fotoUrl} className="portal-animal-photo-thumb"/>
        <div className="canil-residente-info">
          <strong>{a.nombre}</strong>
          <small>{resumirAnimalEnCanil(a)}</small>
        </div>
        <span className="canil-estadia">
          <Clock size={12} aria-hidden="true" /> Estadía · {formatearDiasEnCanil(a.diasEnCanil)}
          {a.diasEnCanil >= DIAS_ESTADIA_PROLONGADA && <span title="Al menos 30 días en este canil">· Estadía prolongada</span>}
        </span>
        {enAnimales && <div className="canil-fila-acciones">
          <Button className="portal-btn portal-btn-secondary canil-accion" aria-label={'Ver ficha de ' + a.nombre}
            onClick={() => navegar('/animales?ficha=' + a.id)}>
            <FileText size={16} aria-hidden="true" /> Ver ficha
          </Button>
          {!residenteUnico && <>
            <Button className="portal-btn portal-btn-primary canil-accion" disabled={espera || enCuarentena}
              aria-label={'Mover a ' + a.nombre} onClick={() => mover(a.id)}>
              <ArrowLeftRight size={16} aria-hidden="true" /> Mover
            </Button>
            <Button className="portal-btn portal-btn-danger canil-accion" disabled={espera || enCuarentena}
              aria-label={'Retirar a ' + a.nombre + ' del canil'}
              onClick={() => asignar({ animalId: a.id, estado: 'LIBRE' })}>
              <LogOut size={16} aria-hidden="true" /> Retirar del canil
            </Button>
          </>}
        </div>}
        {moviendo === a.id && <MoverAnimalDialog animal={a} origen={c} caniles={caniles}
          mover={destino => asignar({canilId:destino,animalId:a.id,origenEsperadoId:c.id,estado:'OCUPADO'})}/>}
      </div>)}
      {mostrarSelector && <>
        <div className="canil-asignacion">
          <AnimalSelect animales={disponibles} describir={resumirAnimalEnCanil} value={seleccionado ? id : ''} onChange={seleccionar} disabled={espera} />
          <Button className="portal-btn portal-btn-primary" disabled={!seleccionado} onClick={() => asignar({
            animalId: seleccionado.id,
            origenEsperadoId: seleccionado.canilId ?? null,
            estado: 'OCUPADO',
            ampliarCapacidad: puedeAmpliar
          })}>
            {enAnimales && <Plus size={16} aria-hidden="true" />}
            {enAnimales && c.animales.length ? 'Agregar otro animal' : 'Asignar animal'}
          </Button>
        </div>
        {puedeAmpliar && !cuposLibres && <p className="canil-ayuda">Al agregar otro animal, la capacidad aumentará a {c.capacidad + 1} cupos.</p>}
      </>}
      {enAnimales && c.capacidad >= 20 && !cuposLibres &&
        <p className="canil-ayuda">El canil alcanzó el máximo de 20 cupos.</p>}

      </section>
      {tab === 'Resumen' && <>
        <section className="canil-modal-seccion"><div className="canil-seccion-cabecera">
          <div><h3 className="canil-modal-seccion-titulo">Sector del canil</h3><span>{c.sector}</span></div>
        <Button className="portal-btn portal-btn-secondary" onClick={() => editar(!edicion)}>{direccion ? 'Editar canil' : 'Cambiar sector'}</Button></div>
        {edicion && <form className="canil-campos" onSubmit={e => {
          e.preventDefault(); const datos=Object.fromEntries(new FormData(e.currentTarget));
          ejecutar(() => direccion ? actualizarCanil(c.id,{...datos,capacidad:Number(datos.capacidad)}) : actualizarSector(c.id,datos));
        }}>
          <SelectorSectorCanil sectores={sectores} sectorInicial={c.sector} />
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
    </fieldset>
    </div>
    {(tab === 'Resumen' || (tab === 'Animales' && residenteUnico)) && <footer className="canil-modal-footer">
      <fieldset disabled={espera} className="canil-acciones">
        {residenteUnico && <Button className="portal-btn portal-btn-primary canil-accion" disabled={espera || enCuarentena} onClick={() => mover(residenteUnico.id)}>
          <ArrowLeftRight size={16} aria-hidden="true" /> Mover animal
        </Button>}
        {c.animales.length > 0 && <Button className="portal-btn portal-btn-danger canil-accion" disabled={espera || enCuarentena} onClick={async () => {
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

export function QrEtiquetasModal({ todos, sector, filtrados, cerrar }) {
  const [alcance, elegir] = useState('todos');
  const [imagenes, guardar] = useState({});
  const [error, setError] = useState('');
  useEffect(() => {
    let vigente = true;
    Promise.all(todos.map(async c => [c.id, await imagenQr(c.id)])).then(pares => {
      if (vigente) guardar(Object.fromEntries(pares));
    }).catch(() => vigente && setError('Error al generar los códigos QR.'));
    return () => { vigente = false; };
  }, [todos]);
  const lista = { todos, sector, filtro: filtrados }[alcance];
  const etiquetasPorHoja = 30;
  const etiquetas = lista.map(c => <article className="qr-etiqueta" key={c.id}>
    <h3>{c.nombre}</h3>
    {imagenes[c.id] && <img src={imagenes[c.id]} alt={'QR de ' + c.nombre} />}
  </article>);
  return <Modal nombre="Etiquetas QR" onClose={cerrar} papel={{ className: "canil-modal canil-qr-modal" }}>
    <header className="canil-modal-header"><div className="canil-icono"><QrCode size={22}/></div><h2>Etiquetas QR</h2>
      <Button className="canil-cerrar" aria-label="Cerrar etiquetas QR" onClick={cerrar}><X size={17}/></Button></header>
    <div className="canil-modal-body"><div className="canil-opciones-qr">
    <label>Imprimir <select value={alcance} onChange={e => elegir(e.target.value)}><option value="todos">Todos los caniles</option><option value="sector">Sector actual</option><option value="filtro">Filtro actual</option></select></label>
    </div>
    {['localhost','127.0.0.1'].includes(new URL(urlCanil(1)).hostname) && <p>La URL del QR apunta a localhost; desde un celular no abrirá. Configura VITE_PUBLIC_APP_URL con el dominio público.</p>}
    {error && <p role="alert">{error}</p>}
    <div className="qr-preview">{etiquetas}</div></div>
    <footer className="canil-modal-footer"><Button className="portal-btn portal-btn-secondary" onClick={cerrar}>Cerrar</Button> <Button className="portal-btn portal-btn-primary" disabled={!lista.length || lista.some(c => !imagenes[c.id])} onClick={() => window.print()}>Imprimir</Button></footer>
    {createPortal(
      <div className="qr-print-area" aria-hidden="true">
        {Array.from({ length: Math.ceil(etiquetas.length / etiquetasPorHoja) }, (_, i) => (
          <div className="qr-hoja" key={i}>
            {etiquetas.slice(i * etiquetasPorHoja, (i + 1) * etiquetasPorHoja)}
          </div>
        ))}
      </div>,
      document.body
    )}
  </Modal>;
}

function medirOcupacion(caniles) {
  return caniles.reduce((totales, canil) => {
    const alojados = canil.animales.length;
    const libreParaAsignar = ['LIBRE', 'OCUPADO'].includes(canil.estado) && !mezclaPerrosYGatos(canil.animales);
    totales.capacidad += canil.capacidad;
    totales.alojados += alojados;
    if (libreParaAsignar) totales.disponibles += Math.max(0, canil.capacidad - alojados);
    return totales;
  }, { capacidad: 0, alojados: 0, disponibles: 0 });
}

function OcupacionCaniles({ caniles, sectores, cargando }) {
  if (cargando && !caniles.length) return <p role="status">Cargando ocupación…</p>;
  const { capacidad, alojados, disponibles } = medirOcupacion(caniles);
  const porcentaje = capacidad ? Math.round(alojados / capacidad * 100) : null;
  const estados = [
    ['LIBRE', 'Libres'], ['OCUPADO', 'Ocupados'],
    ['CUARENTENA', 'En cuarentena'], ['MANTENIMIENTO', 'En mantención']
  ];
  const porSeparar = caniles.filter(canil => mezclaPerrosYGatos(canil.animales));
  const alertaOcupacion = porcentaje > 90;
  const indicadores = [
    { etiqueta: 'Ocupación total', valor: porcentaje === null ? '—' : porcentaje + '%',
      detalle: alertaOcupacion ? 'Ocupación sobre el 90%' : `${alojados} / ${capacidad} cupos ocupados`, Icono: TrendingUp, alerta: alertaOcupacion },
    { etiqueta: 'Animales alojados', valor: alojados, Icono: PawPrint },
    { etiqueta: 'Capacidad total', valor: capacidad, detalle: `${caniles.length} caniles`, Icono: DoorOpen },
    { etiqueta: 'Cupos disponibles', valor: disponibles, detalle: 'Cupos habilitados para asignar', Icono: ShieldCheck }
  ];
  return (
    <section className="canil-ocupacion" aria-labelledby="canil-ocupacion-titulo">
      <h3 id="canil-ocupacion-titulo">Ocupación de caniles</h3>
      {porSeparar.length > 0 && <p className="portal-alert" role="status">
        Perros y gatos por separar en {porSeparar.map(canil => canil.nombre).join(', ')}.
      </p>}
      <dl className="canil-kpis">
        {indicadores.map(({ etiqueta, valor, detalle, Icono, alerta }) => (
          <div className={`canil-kpi${alerta ? ' canil-kpi-alerta' : ''}`} key={etiqueta}>
            <dt>{etiqueta}<span className="canil-kpi-icono"><Icono size={20} aria-hidden="true" /></span></dt>
            <dd><strong>{valor}</strong>{detalle && <small>{detalle}</small>}</dd>
          </div>
        ))}
      </dl>
      <p>La ocupación compara los animales alojados con la capacidad total. Los cupos disponibles excluyen caniles en cuarentena, en mantención o con perros y gatos por separar.</p>
      <div className="canil-ocupacion-paneles">
        <section className="canil-ocupacion-panel">
          <h4><ChartColumn size={17} aria-hidden="true" /> Ocupación por sector</h4>
          {!sectores.length ? <p>No hay caniles registrados.</p> : (
            <ul className="canil-ocupacion-sectores">
              {sectores.map(sector => {
                const datos = medirOcupacion(caniles.filter(canil => canil.sector === sector));
                const ocupacionAlta = datos.capacidad > 0 && datos.alojados / datos.capacidad > 0.9;
                return <li key={sector}>
                  <div><strong>{sector}</strong><span>{datos.alojados} / {datos.capacidad} cupos · {datos.disponibles} disponibles</span></div>
                  <progress className={ocupacionAlta ? 'canil-progreso-alerta' : undefined}
                    aria-label={`Ocupación de ${sector}`} value={datos.alojados} max={datos.capacidad || 1} />
                </li>;
              })}
            </ul>
          )}
        </section>
        <section className="canil-ocupacion-panel">
          <h4><DoorOpen size={17} aria-hidden="true" /> Caniles por estado</h4>
          <dl className="canil-ocupacion-estados">
            {estados.map(([estado, etiqueta]) => <div key={estado} data-estado={estado}>
              <dt>{etiqueta}</dt><dd>{caniles.filter(canil => canil.estado === estado).length}</dd>
            </div>)}
          </dl>
        </section>
      </div>
    </section>
  );
}

export default function CanilesPage({ user }) {
  const { avisar } = usePortalFeedback();
  const [caniles, setCaniles] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [animales, setAnimales] = useState([]);
  const [traslados, setTraslados] = useState([]);
  const [errorMapa, setErrorMapa] = useState('');
  const [cargando, setCargando] = useState(true);
  const [tab, setTab] = useState('mapa');
  const [busquedasBitacora, setBusquedasBitacora] = useState({});
  const [busquedaMapa, setBusquedaMapa] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('TODOS'); // 'TODOS' | 'LIBRE' | 'OCUPADO' | 'CUARENTENA'
  const [filtroSector, setFiltroSector] = useState('TODOS');
  const [avisosOpen, setAvisosOpen] = useState(false);

  // Formulario Agregar Canil
  const [agregarCanilOpen, setAgregarCanilOpen] = useState(false);
  const altaCanilForm = useFormulario(crearCanilSchema, { sector: '' });
  const nuevoCanil = altaCanilForm.valores;
  const [errorNuevoCanil, setErrorNuevoCanil] = useState(null);
  const creandoCanil = altaCanilForm.isSubmitting;

  // Confirmación Eliminar Canil
  const [eliminarCanil, setEliminarCanil] = useState(null);
  const [eliminarConfirmOpen, setEliminarConfirmOpen] = useState(false);
  const [eliminandoCanil, setEliminandoCanil] = useState(false);

  const { canilId } = useParams();
  const [seleccion, seleccionar] = useState(null);
  const selectedCanil = caniles.find(c => c.id === seleccion);
  const [mensajeExito, setMensajeExito] = useState('');
  const [qr, abrirQr] = useState(false);
  const [orden, ordenar] = useState('nombre');
  const [arrastre, arrastrar] = useState(null);
  const [dockRetraido, retraerDock] = useState(true);
  const [guardando, guardar] = useState(false);
  const [undo, deshacer] = useState(null);
  const ejecutarDeshacer = useRef(null);
  useEffect(() => {
    ejecutarDeshacer.current = movimiento => moverAnimal(
      movimiento.animal,
      caniles.find(c => c.id === movimiento.origen),
      movimiento.destino === null ? null : caniles.find(c => c.id === movimiento.destino),
      true
    );
  });
  const sensores = useCanilesDragAndDrop();
  useEffect(() => seleccionar(canilId ? Number(canilId) : null), [canilId]);
  useEffect(() => {
    if (!undo || guardando) return;
    const mensaje = undo.liberar ? undo.animal.nombre + ' quedó sin canil.' : 'Se movió a ' + undo.animal.nombre + '.';
    return avisar(mensaje, 'exito', {
      etiqueta: 'Deshacer',
      ejecutar: () => ejecutarDeshacer.current(undo)
    });
  }, [undo, guardando, avisar]);

  // Formulario Solicitud de Traslado Externo (Protectora o Hogar Temporal)
  const trasladoForm = useFormulario(trasladoSchema, {
    animalId: '',
    tipo: 'PROTECTORA_ALIADA',
    destinoNombre: '',
    destinoContacto: '',
    destinoEmail: '',
    destinoDireccion: '',
    motivo: ''
  });
  const trasladoExterno = trasladoForm.valores;
  const setTrasladoExterno = actualizar => typeof actualizar === 'function' ? trasladoForm.cambiarCampos(actualizar) : trasladoForm.reset(actualizar);
  const [errorExterno, setErrorExterno] = useState(null);

  // Detalle y aprobación de traslados
  const [detalleTraslado, setDetalleTraslado] = useState(null);
  const aprobacionForm = useFormulario(aprobacionTrasladoSchema, { aprobar: true, comentario: '' });
  const [errorAprobacion, setErrorAprobacion] = useState(null);
  const procesandoAprobacion = aprobacionForm.isSubmitting;

  // Sectores ya registrados (se derivan de los caniles existentes, por lo que
  // quedan guardados en la base de datos al crear cada canil).
  const sectoresExistentes = React.useMemo(
    () => [...new Set(caniles.map(c => c.sector).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [caniles]
  );

  // Próximo número de canil a partir del mayor "Canil N" existente.
  const getProximoNumeroCanil = () => {
    const numeros = caniles
      .map(c => {
        const match = String(c.nombre || '').match(/(\d+)\s*$/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(n => n > 0);
    return (numeros.length ? Math.max(...numeros) : caniles.length) + 1;
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  // Si el sector filtrado deja de existir (por ejemplo, al cambiarlo de sector),
  // volvemos automáticamente a "Todos" para no dejar la vista vacía.
  useEffect(() => {
    if (filtroSector !== 'TODOS' && !sectoresExistentes.includes(filtroSector)) {
      setFiltroSector('TODOS');
    }
  }, [filtroSector, sectoresExistentes]);

  const cargarDatos = async () => {
    setCargando(true);
    try {
      const [resCaniles, resAnimals, resTraslados] = await Promise.all([
        listarCaniles(),
        listarAnimales(),
        listarTraslados()
      ]);

      if (!resCaniles.ok) throw Error('No se pudo cargar el mapa de caniles.');
      setErrorMapa('');
      if (resCaniles.ok) {
        const dataCaniles = await resCaniles.json();
        setCaniles(dataCaniles.caniles || []);
        setResumen(dataCaniles.resumen || null);
      }
      if (resAnimals.ok) {
        const dataAnimals = await resAnimals.json();
        setAnimales(dataAnimals || []);
      }
      if (resTraslados.ok) {
        const dataT = await resTraslados.json();
        setTraslados(dataT || []);
      }
    } catch (err) {
      setErrorMapa('No se pudo cargar el mapa de caniles.');
    } finally {
      setCargando(false);
    }
  };

  async function moverAnimal(animal, origen, destino, inverso = false) {
    if (guardando) return;
    const liberar = destino === null;
    if (liberar && !origen) return;
    if (liberar && origen.estado === 'CUARENTENA') {
      avisar('Finaliza la cuarentena antes de liberar al animal.', 'error');
      return;
    }
    const razon = liberar ? '' : destinoInvalido(animal, destino, origen);
    if (razon) { avisar(razon, 'error'); return; }
    guardar(true);
    deshacer(null);
    const anteriores = caniles;
    const animalesAnteriores = animales;
    setAnimales(actuales => actuales.map(actual =>
      actual.id === animal.id ? { ...actual, canilId: destino?.id ?? null } : actual));
    setCaniles(caniles.map(c => {
      if (c.id !== origen?.id && c.id !== destino?.id) return c;
      const residentes = c.id === origen?.id ? c.animales.filter(a => a.id !== animal.id) : [...c.animales,{...animal,diasEnCanil:0}];
      return { ...c, animales:residentes, animalAlojado:residentes[0], estado:residentes.length ? 'OCUPADO' : 'LIBRE',
        ocupacion:{ ...c.ocupacion, alojados: residentes.length, libres:c.capacidad-residentes.length } };
    }));
    try {
      const r = await asignarCanil({
        canilId: liberar ? origen.id : destino.id,
        animalId: animal.id,
        origenEsperadoId: origen?.id ?? null,
        estado: liberar ? 'LIBRE' : 'OCUPADO',
        motivo: inverso ? 'Deshacer movimiento' : liberar ? 'Liberación desde el mapa'
          : origen ? 'Reubicación desde el mapa' : 'Asignación desde animales sin canil'
      });
      if (!r.ok) throw Error(formatearErrorApi(await r.json(), 'No se pudo mover al animal.'));
      if (!inverso) deshacer({ animal, origen: destino?.id ?? null, destino: origen?.id ?? null, liberar });
      else avisar('Movimiento deshecho.', 'exito');
    } catch (e) {
      setCaniles(anteriores);
      setAnimales(animalesAnteriores);
      avisar(e.message, 'error');
    }
    finally { await cargarDatos(); guardar(false); }
  }

  const handleSolicitarExterno = async (trasladoExterno) => {
    setErrorExterno(null);

    if (!trasladoExterno.animalId) {
      setErrorExterno('Debes seleccionar un animal');
      return;
    }
    if (!trasladoExterno.motivo.trim()) {
      setErrorExterno('El motivo del traslado es obligatorio');
      return;
    }
    if (!trasladoExterno.destinoNombre.trim()) {
      setErrorExterno('Indica la protectora aliada u hogar de acogida');
      return;
    }

    try {
      const res = await solicitarTraslado({
          ...trasladoExterno,
          animalId: parseInt(trasladoExterno.animalId)
        });

      const data = await res.json();
      if (!res.ok) throw new Error(formatearErrorApi(data, 'Error al solicitar traslado'));

      setMensajeExito('Traslado registrado y pendiente de aprobación de Dirección.');
      setTimeout(() => setMensajeExito(null), 4000);
      setTrasladoExterno({
        animalId: '',
        tipo: 'PROTECTORA_ALIADA',
        destinoNombre: '',
        destinoContacto: '',
        destinoEmail: '',
        destinoDireccion: '',
        motivo: ''
      });
      setTab('traslados-externos');
      await cargarDatos();
    } catch (err) {
      setErrorExterno(formatearErrorApi(err));
    }
  };

  const handleOpenAgregarCanil = () => {
    // Preferir el sector del último canil creado; si no hay, el primero disponible.
    const ultimoCanil = [...caniles].sort((a, b) => b.id - a.id)[0];
    const sectorPorDefecto = ultimoCanil?.sector || sectoresExistentes[0] || '';
    altaCanilForm.reset({ sector: sectorPorDefecto });
    setErrorNuevoCanil(null);
    setAgregarCanilOpen(true);
  };

  const handleCrearCanil = async (nuevoCanil) => {
    setErrorNuevoCanil(null);

    if (!nuevoCanil.sector.trim()) {
      setErrorNuevoCanil('Selecciona un sector existente o escribe uno nuevo');
      return;
    }

    // Nombre y código automáticos: "Canil 12", "Canil 13", ...
    const numero = getProximoNumeroCanil();
    const nombre = `Canil ${numero}`;
    let codigo = `C-${String(numero).padStart(2, '0')}`;
    const codigosExistentes = new Set(caniles.map(c => c.codigo));
    let sufijo = 0;
    while (codigosExistentes.has(codigo)) {
      sufijo += 1;
      codigo = `C-${String(numero).padStart(2, '0')}-${sufijo}`;
    }

    try {
      const res = await crearCanil({
          codigo,
          nombre,
          sector: nuevoCanil.sector.trim(),
          capacidad: nuevoCanil.capacidad,
          estado: 'LIBRE'
        });

      const data = await res.json();
      if (!res.ok) throw new Error(formatearErrorApi(data, 'Error al crear canil'));

      setMensajeExito(data.message || 'Canil creado con éxito');
      setTimeout(() => setMensajeExito(null), 4000);
      setAgregarCanilOpen(false);
      altaCanilForm.reset({ sector: '' });
      setErrorNuevoCanil(null);
      await cargarDatos();
    } catch (err) {
      setErrorNuevoCanil(formatearErrorApi(err));
    }
  };

  const handleConfirmarEliminarCanil = async () => {
    if (!eliminarCanil) return;
    setEliminandoCanil(true);
    try {
      const res = await eliminarCanilApi(eliminarCanil.id);
      const data = await res.json();
      if (!res.ok) throw new Error(formatearErrorApi(data));

      setMensajeExito(data.mensaje || 'Canil eliminado correctamente');
      setTimeout(() => setMensajeExito(null), 4000);
      setEliminarConfirmOpen(false);
      setEliminarCanil(null);
      await cargarDatos();
    } catch (err) {
      avisar(formatearErrorApi(err), 'error');
    } finally {
      setEliminandoCanil(false);
    }
  };

  const handleGestionarAprobacion = async ({ aprobar, comentario }) => {
    setErrorAprobacion(null);
    try {
      const res = await resolverTraslado(detalleTraslado.id, { aprobar, comentario: comentario || null });
      const data = await res.json();
      if (!res.ok) throw new Error(formatearErrorApi(data));

      setMensajeExito(data.message || (aprobar ? 'Traslado aprobado correctamente' : 'Traslado rechazado'));
      setTimeout(() => setMensajeExito(null), 4000);
      setDetalleTraslado(null);
      setErrorAprobacion(null);
      await cargarDatos();
    } catch (err) {
      setErrorAprobacion(formatearErrorApi(err));
    }
  };

  const enviarAprobacion = aprobar => {
    aprobacionForm.cambiar('aprobar', aprobar);
    return aprobacionForm.handleSubmit(handleGestionarAprobacion)();
  };

  const esDireccion = user?.rol === 'DIRECCION';

  const movimientosCaniles = traslados.filter(t => t.tipo === 'INTERNO_CANIL');
  const trasladosExternos = traslados.filter(t => t.tipo !== 'INTERNO_CANIL');
  const trasladosPendientes = trasladosExternos.filter(t => t.estado === 'PENDIENTE_APROBACION');
  const verMovimientosCaniles = tab === 'movimientos-caniles';
  const verBitacora = verMovimientosCaniles || tab === 'traslados-externos';
  const busqueda = busquedasBitacora[tab] || '';
  const consulta = normalizarBusqueda(busqueda);
  const historial = verMovimientosCaniles ? movimientosCaniles : trasladosExternos;
  const registrosBitacora = consulta ? historial.filter(t => {
    const campos = [
      t.animal?.nombre, t.responsable?.nombre, ESTADOS_TRASLADO[t.estado]?.etiqueta,
      formatearFecha(t.fechaRegistro), ETIQUETAS_TIPO_TRASLADO[t.tipo],
      t.canilOrigen?.nombre || (verMovimientosCaniles ? 'Ingreso' : ''),
      t.canilDestino?.nombre, t.destinoNombre, t.destinoContacto
    ];
    return normalizarBusqueda(campos.join(' ')).includes(consulta);
  }) : historial;
  const avisosCaniles = [
    ...caniles.filter(c => c.cuarentena && c.cuarentena.diasRestantes <= 1).map(c => ({
      tipo: c.cuarentena.vencida ? 'CRITICA' : 'ALERTA', titulo: c.nombre, canilId: c.id,
      clave: 'caniles:cuarentena:' + (c.cuarentena.vencida ? 'vencida:' : 'porvencer:') + c.cuarentena.id,
      mensaje: textoCuarentena(c.cuarentena), tab:'mapa'
    })),
    ...(resumen?.alertaSobrecupo
      ? [{
          tipo: 'CRITICA',
          titulo: 'Sobrecupo crítico en caniles',
          clave: `caniles:sobrecupo:${resumen.libres}:${resumen.porcentajeOcupacion}`.replace('.', '-'),
          mensaje: `La ocupación alcanzó el ${resumen.porcentajeOcupacion}%. Solo quedan ${resumen.libres} caniles libres.`,
          tab: 'mapa'
        }]
      : []),
    ...(resumen && !resumen.alertaSobrecupo && resumen.cuposLibres === 0
      ? [{
          tipo: 'ALERTA',
          titulo: 'Sin caniles libres',
          clave: 'caniles:sin-libres',
          mensaje: 'No hay espacios disponibles para alojar o reubicar animales.',
          tab: 'mapa'
        }]
      : []),
    ...(esDireccion && trasladosPendientes.length > 0
      ? [{
          tipo: 'ALERTA',
          titulo: 'Traslados pendientes de aprobación',
          clave: `caniles:traslados:${trasladosPendientes[0].id}:${trasladosPendientes.length}`,
          mensaje: `${trasladosPendientes.length} solicitud(es) esperan la revisión de Dirección.`,
          tab: 'traslados-externos'
        }]
      : [])
  ];

  const lecturas = useLecturasNotificaciones(avisosCaniles.map(aviso => aviso.clave));

  const canilesDelSector = filtroSector === 'TODOS'
    ? caniles
    : caniles.filter(c => c.sector === filtroSector);
  const textoMapa = normalizarBusqueda(busquedaMapa);
  const coincidencias = canilesDelSector.filter(c => normalizarBusqueda([c.nombre, ...c.animales.map(a => a.nombre)].join(' ')).includes(textoMapa));
  const contarCanilesPorEstado = (estado) => coincidencias.filter(c => c.estado === estado).length;
  const filtrosCaniles = [
    { valor: 'TODOS', etiqueta: 'Todos', cantidad: coincidencias.length },
    { valor: 'LIBRE', etiqueta: 'Libres', cantidad: contarCanilesPorEstado('LIBRE') },
    { valor: 'OCUPADO', etiqueta: 'Ocupados', cantidad: contarCanilesPorEstado('OCUPADO') },
    { valor: 'MANTENIMIENTO', etiqueta: 'Mantenimiento', cantidad: contarCanilesPorEstado('MANTENIMIENTO') },
    { valor: 'CUARENTENA', etiqueta: 'Cuarentena', cantidad: contarCanilesPorEstado('CUARENTENA') }
  ];
  const canilesFiltrados = (filtroEstado === 'TODOS'
    ? coincidencias
    : coincidencias.filter(c => c.estado === filtroEstado)).slice().sort((a,b) => {
      if (orden === 'dias') return Math.max(0,...b.animales.map(x => x.diasEnCanil)) - Math.max(0,...a.animales.map(x => x.diasEnCanil));
      if (orden === 'ocupacion') return b.ocupacion.porcentaje - a.ocupacion.porcentaje;
      return a[orden].localeCompare(b[orden], 'es', { numeric:true });
    });

  const abrirDetalleTraslado = (traslado) => {
    setDetalleTraslado(traslado);
    aprobacionForm.reset({ aprobar: true, comentario: '' });
    setErrorAprobacion(null);
  };

  const cerrarDetalleTraslado = () => {
    setDetalleTraslado(null);
    setErrorAprobacion(null);
  };

  const detalleEstadoInfo = detalleTraslado
    ? (ESTADOS_TRASLADO[detalleTraslado.estado] || {
        etiqueta: detalleTraslado.estado.replace('_', ' '),
        bg: '#e9eaed',
        color: 'var(--portal-text-muted)'
      })
    : null;
  const detalleEsInterno = detalleTraslado?.tipo === 'INTERNO_CANIL';
  const detalleOrigen = detalleTraslado
    ? (detalleTraslado.canilOrigen?.nombre || (detalleEsInterno ? 'Ingreso al refugio' : 'Refugio Huellas Sin Hogar'))
    : '';
  const detalleDestino = detalleTraslado
    ? (detalleEsInterno ? (detalleTraslado.canilDestino?.nombre || '—') : (detalleTraslado.destinoNombre || '—'))
    : '';
  const alojados = new Set(caniles.flatMap(canil => canil.animales.map(animal => animal.id)));
  const animalesSinCanil = animales.filter(animal => animal.activo !== false &&
    animal.estadoAdopcion !== 'ADOPTADO' && animal.canilId == null && !alojados.has(animal.id));
  const puedeAprobarTraslado = esDireccion && !detalleEsInterno && detalleTraslado?.estado === 'PENDIENTE_APROBACION';
  return (
    <div className={tab === 'mapa' ? 'portal-page-container portal-page-scroll portal-page-scroll-con-filtros' : 'portal-page-container portal-page-scroll'}>
      <div className="portal-header">
        <div>
          <h2 className="portal-header-title">
            <DoorOpen size={26} aria-hidden="true" />
            <span>Módulo de Caniles y Traslados</span>
          </h2>
          <p className="portal-header-subtitle">
            Mapa visual de espacios, reubicaciones internas y traslados a protectoras / hogares temporales
          </p>
        </div>

        <div className="portal-header-actions">
          <Button className="portal-btn portal-btn-secondary" onClick={() => abrirQr(true)}><QrCode size={16}/> Etiquetas QR</Button>
          <Button
            type="button"
            onClick={handleOpenAgregarCanil}
            className="portal-btn portal-btn-primary"
          >
            <Plus size={16} aria-hidden="true" /> Agregar Canil
          </Button>

          {/* Campanita de avisos, estilo dashboard */}
          <div style={{ position: 'relative' }}>
            <Button
              type="button"
              onClick={() => setAvisosOpen(v => !v)}
              aria-label="Avisos de caniles"
              aria-expanded={avisosOpen}
              title="Avisos de caniles"
              style={{
                position: 'relative',
                background: avisosOpen ? 'var(--portal-primary-soft)' : '#fff',
                border: `var(--portal-border-emphasis) solid ${avisosOpen ? 'var(--portal-primary)' : '#e9eaed'}`,
                borderRadius: '8px',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <Bell size={20} aria-hidden="true" />
              {lecturas.pendientes > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-6px',
                  right: '-6px',
                  minWidth: '18px',
                  height: '18px',
                  padding: '0 4px',
                  borderRadius: '9px',
                  background: '#b82d44',
                  color: '#fff',
                  fontSize: '0.68rem',
                  fontWeight: '800',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxSizing: 'border-box'
                }}>
                  {lecturas.pendientes}
                </span>
              )}
            </Button>

            {avisosOpen && (
              <>
                <div
                  onClick={() => setAvisosOpen(false)}
                  style={{ position: 'fixed', inset: 0, zIndex: 400 }}
                />
                <div style={{
                  position: 'absolute',
                  top: '48px',
                  right: 0,
                  width: 'min(380px, calc(100vw - 48px))',
                  background: 'var(--portal-surface)',
                  border: 'var(--portal-border-emphasis) solid var(--portal-border)',
                  borderRadius: '14px',
                  boxShadow: '0 12px 32px rgba(20,24,32,0.14)',
                  zIndex: 401,
                  overflow: 'hidden'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '14px 16px',
                    borderBottom: 'var(--portal-border-emphasis) solid #f0f1f3'
                  }}>
                    <span style={{
                      fontSize: '0.78rem',
                      fontWeight: '800',
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      color: '#1f2430'
                    }}>
                      Avisos de Caniles
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--portal-text-muted)', fontWeight: '600' }}>
                      Sin leer: {lecturas.pendientes}
                    </span>
                  </div>

                  <div style={{ maxHeight: '340px', overflowY: 'auto', padding: '10px' }}>
                    {avisosCaniles.length === 0 ? (
                      <div style={{ padding: '18px 12px', textAlign: 'center', color: 'var(--portal-text-muted)', fontSize: '0.84rem' }}>
                        <ShieldCheck size={22} aria-hidden="true" style={{ marginBottom: '6px' }} />
                        <div>No hay avisos de caniles en este momento.</div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {avisosCaniles.map(aviso => {
                          const esCritica = aviso.tipo === 'CRITICA';
                          const Icono = esCritica ? Siren : TriangleAlert;
                          const color = esCritica ? '#b82d44' : '#895100';
                          const bg = esCritica ? '#ffe4e6' : '#fff0ca';

                          return (
                            <div key={aviso.clave}>
                            <Button
                              type="button"
                              onClick={() => {
                                setAvisosOpen(false);
                                setTab(aviso.tab);
                                lecturas.marcar(aviso.clave);

                                if (aviso.canilId) seleccionar(aviso.canilId);
                              }}
                              style={{
                                width: '100%',
                                textAlign: 'left',
                                background: bg,
                                border: 'none',
                                borderLeft: `4px solid ${color}`,
                                borderRadius: '9px',
                                padding: '12px 14px',
                                cursor: 'pointer',
                                display: 'block',
                                minHeight: 0
                              }}
                            >
                              <span style={{
                                color,
                                fontSize: '0.86rem',
                                fontWeight: '800',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                marginBottom: '3px'
                              }}>
                                <Icono size={14} aria-hidden="true" /> {aviso.titulo}
                              </span>
                              <span style={{ fontSize: '0.78rem', color: '#555e6d', lineHeight: 1.35, display: 'block' }}>
                                {aviso.mensaje}
                              </span>
                            </Button>
                            {lecturas.leidas.has(aviso.clave) ? <small>Leída</small> : (
                              <Button variante="texto" onClick={() => lecturas.marcar(aviso.clave)}>Marcar como leída</Button>
                            )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Pestañas Subnavegación */}
      <div className="portal-subtabs">
        <Button
          onClick={() => setTab('mapa')}
          className={`portal-subtab-btn ${tab === 'mapa' ? 'active' : ''}`}
        >
          <Map size={15} aria-hidden="true" /> Mapa de Caniles
        </Button>
        <Button
          onClick={() => setTab('movimientos-caniles')}
          className={`portal-subtab-btn ${verMovimientosCaniles ? 'active' : ''}`}
          aria-pressed={verMovimientosCaniles}
        >
          <ArrowLeftRight size={15} aria-hidden="true" /> Movimientos de Caniles
        </Button>
        <Button
          onClick={() => setTab('solicitar')}
          className={`portal-subtab-btn ${tab === 'solicitar' ? 'active' : ''}`}
        >
          <Send size={15} aria-hidden="true" /> Solicitar Traslado Externo
        </Button>
        <Button
          onClick={() => setTab('traslados-externos')}
          className={`portal-subtab-btn ${tab === 'traslados-externos' ? 'active' : ''}`}
          aria-pressed={tab === 'traslados-externos'}
        >
          <ClipboardList size={15} aria-hidden="true" /> Traslados Externos
        </Button>
        <Button
          onClick={() => setTab('ocupacion')}
          className={`portal-subtab-btn ${tab === 'ocupacion' ? 'active' : ''}`}
          aria-pressed={tab === 'ocupacion'}
        >
          <ChartColumn size={15} aria-hidden="true" /> Ocupación
        </Button>
      </div>


      {qr && <QrEtiquetasModal todos={caniles} sector={canilesDelSector} filtrados={canilesFiltrados} cerrar={() => abrirQr(false)}/>}
      {errorMapa && <p role="alert">{errorMapa} <Button onClick={cargarDatos}>Reintentar</Button></p>}
      {canilId && !errorMapa && !cargando && !caniles.some(c => c.id === Number(canilId)) && <p role="alert">El canil solicitado no existe o fue eliminado. <a href="/caniles">Volver al mapa</a></p>}
      {mensajeExito && (
        <div className="portal-alert portal-alert-success" style={{ marginBottom: '18px', fontWeight: '600' }}>
          ✓ {mensajeExito}
        </div>
      )}

      {/* MODAL AGREGAR CANIL */}
      {agregarCanilOpen && (
        <Modal onClose={() => setAgregarCanilOpen(false)} bloqueado={creandoCanil} aria-labelledby="titulo-agregar-canil"
          papel={{ style: {
            background: 'var(--portal-surface)', borderRadius: '18px', padding: '26px', width: '100%', maxWidth: '640px',
            maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 12px 36px rgba(20,24,32,0.2)',
            boxSizing: 'border-box'
          } }}>
            <h3 id="titulo-agregar-canil" style={{ margin: '0 0 8px', color: '#1f2430', display: 'flex', alignItems: 'center', gap: '7px' }}><Plus size={19} aria-hidden="true" /> Agregar Nuevo Canil</h3>
          <p style={{ color: 'var(--portal-text-muted)', fontSize: '0.84rem', margin: '0 0 18px' }}>
            Completa los datos del nuevo canil. Quedará disponible como LIBRE para asignar animales.
          </p>

          {errorNuevoCanil && (
            <div style={{ background: '#ffe4e6', color: '#b82d44', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', fontSize: '0.82rem' }}>
              {errorNuevoCanil}
            </div>
          )}

          <form noValidate onSubmit={altaCanilForm.handleSubmit(handleCrearCanil)}>
            <div style={{
              background: 'var(--portal-surface-muted)', border: 'var(--portal-border-emphasis) solid var(--portal-border)', borderRadius: '10px',
              padding: '12px 14px', marginBottom: '14px', fontSize: '0.84rem', color: '#555e6d'
            }}>
              Se creará <strong>Canil {getProximoNumeroCanil()}</strong>
            </div>

            <SelectorSectorCanil sectores={sectoresExistentes} sectorInicial={nuevoCanil.sector}
              onChange={sector => altaCanilForm.cambiar('sector', sector)} error={altaCanilForm.errorCampo('sector')} />

            <div className="canil-campos">
              <label>Capacidad<Input type="number" className="portal-input" min={1} max={20} value={nuevoCanil.capacidad ?? 1} onChange={e => altaCanilForm.cambiar('capacidad',e.target.value)}/><ErrorCampo error={altaCanilForm.errorCampo('capacidad')}/></label>
              <small className="canil-ancho">Usa capacidad mayor a 1 para camadas o grupos compatibles.</small>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <Button
                type="button"
                onClick={() => setAgregarCanilOpen(false)}
                style={{ padding: '9px 16px', background: 'transparent', border: 'var(--portal-border-emphasis) solid var(--portal-border)', borderRadius: '8px', cursor: 'pointer' }}
              >
                Cancelar
              </Button>
              <Button cargando={altaCanilForm.isSubmitting}
                type="submit"
                disabled={creandoCanil}
                style={{ padding: '9px 20px', background: 'var(--portal-primary)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
              >
                {creandoCanil ? 'Creando...' : 'Crear Canil'}
              </Button>
            </div>
          </form>
          </Modal>
      )}

      {tab === 'mapa' && (
        <Card className="portal-card portal-filtros-card">
          <div className="portal-filtros portal-filtros-caniles canil-filtros-mapa">
            <div className="portal-filtros-campo">
              <label htmlFor="buscar-canil" className="portal-filtros-etiqueta">Buscar canil o animal</label>
              <div className="portal-filtros-buscador">
                <Search size={16} aria-hidden="true" className="portal-filtros-buscador-icono" />
                <Input id="buscar-canil" type="search" autoComplete="off" className="portal-input"
                  placeholder="Nombre del canil o del animal…" value={busquedaMapa}
                  onChange={e => setBusquedaMapa(e.target.value)} />
              </div>
            </div>
            <div className="portal-filtros-campo">
              <label htmlFor="filtro-estado-caniles" className="portal-filtros-etiqueta">Estado del canil</label>
              <Input as="select" id="filtro-estado-caniles" className="portal-select" value={filtroEstado}
                onChange={e => setFiltroEstado(e.target.value)}>
                {filtrosCaniles.map(filtro => (
                  <option key={filtro.valor} value={filtro.valor}>{filtro.etiqueta} ({filtro.cantidad})</option>
                ))}
              </Input>
            </div>
            <div className="portal-filtros-campo">
              <label htmlFor="filtro-sector-caniles" className="portal-filtros-etiqueta">Sector</label>
              <Input as="select" id="filtro-sector-caniles" className="portal-select" value={filtroSector}
                onChange={e => setFiltroSector(e.target.value)}>
                <option value="TODOS">Todos los sectores ({caniles.length})</option>
                {sectoresExistentes.map(sector => <option key={sector}>{sector}</option>)}
              </Input>
            </div>
            <div className="portal-filtros-campo">
              <label htmlFor="orden-caniles" className="portal-filtros-etiqueta">Ordenar por</label>
              <Input as="select" id="orden-caniles" className="portal-select" value={orden} onChange={e => ordenar(e.target.value)}>
                <option value="nombre">Nombre</option><option value="sector">Sector</option>
                <option value="dias">Más días ocupado</option><option value="ocupacion">Ocupación</option>
              </Input>
            </div>
          </div>
          {(busquedaMapa || filtroEstado !== 'TODOS' || filtroSector !== 'TODOS') && (
            <div className="portal-filtros-acciones">
              <Button className="portal-btn portal-btn-secondary portal-filtros-limpiar" onClick={() => {
                setBusquedaMapa('');
                setFiltroEstado('TODOS');
                setFiltroSector('TODOS');
              }}>
                <X size={14} aria-hidden="true" /> Limpiar filtros
              </Button>
            </div>
          )}
        </Card>
      )}
      {/* CONTENIDO SEGÚN TAB */}
      <div key={tab} className={`portal-page-scroll-content${tab === 'mapa' ? ' canil-mapa-scroll' : verBitacora ? ' canil-bitacora-scroll' : ''}`}>
      {tab === 'ocupacion' && <OcupacionCaniles caniles={caniles} cargando={cargando} sectores={sectoresExistentes} />}
      {tab === 'mapa' && (
        <div className="canil-mapa-contenido">
          <div className="canil-mapa-leyenda">
            <span style={{ fontSize: '0.9rem', color: 'var(--portal-text-muted)', fontWeight: '600' }}>
              Haz clic en cualquier canil para reubicar, asignar o liberar un animal.
            </span>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.75rem', background: 'var(--portal-primary-soft)', color: 'var(--portal-primary-dark)', padding: '4px 10px', borderRadius: '6px', fontWeight: '700' }}>● LIBRE</span>
              <span style={{ fontSize: '0.75rem', background: '#fff0ca', color: '#895100', padding: '4px 10px', borderRadius: '6px', fontWeight: '700' }}>● OCUPADO</span>
              <span style={{ fontSize: '0.75rem', background: '#ffe4e6', color: '#b82d44', padding: '4px 10px', borderRadius: '6px', fontWeight: '700' }}>● CUARENTENA</span>
            </div>
          </div>

          <DndContext accessibility={accesibilidadArrastre} sensors={sensores}
            collisionDetection={args => {
              const destinos = args.active.data.current.origen ? args.droppableContainers :
                args.droppableContainers.filter(destino => !destino.data.current.sinCanil);
              const detectar = args.pointerCoordinates ? pointerWithin : closestCenter;
              return detectar({ ...args, droppableContainers: destinos });
            }}
            onDragStart={e => arrastrar(e.active.data.current)} onDragCancel={() => arrastrar(null)}
            onDragEnd={({ active, over }) => {
              arrastrar(null);
              const { animal, origen } = active.data.current;
              if (!over || over.id === origen?.id) return;
              const destino = over.id === DESTINO_SIN_CANIL ? null : caniles.find(canil => canil.id === over.id);
              moverAnimal(animal, origen, destino);
            }}>
            <div className={`canil-mapa-layout${dockRetraido ? ' canil-mapa-retraido' : ''}`}>
              <AnimalesSinCanil animales={animalesSinCanil} retraido={dockRetraido}
                cambiar={() => retraerDock(anterior => !anterior)} bloqueado={guardando || cargando} />
              {canilesFiltrados.length ? (
                <div className="canil-grid">
                  {canilesFiltrados.map(canil => <CanilCard key={canil.id} canil={canil} abrir={destino => seleccionar(destino.id)}
                    resaltado={Number(canilId) === canil.id} bloqueado={guardando || cargando} />)}
                </div>
              ) : <p className="canil-mapa-vacio">No hay caniles que coincidan con el filtro seleccionado.</p>}
            </div>
            <DragOverlay>{arrastre && <div className="canil-tarjeta">
              <AnimalPhoto src={arrastre.animal.fotoUrl} className="portal-animal-photo-thumb" />
              {arrastre.animal.nombre} · {arrastre.origen?.nombre || 'Sin canil'}
            </div>}</DragOverlay>
          </DndContext>
        </div>
      )}

      {verBitacora && (
        <div className="canil-bitacora">
          <h3 id="caniles-bitacora-titulo" style={{ margin: '0 0 16px', color: '#1f2430' }}>
            {verMovimientosCaniles ? 'Bitácora de Movimientos de Caniles' : 'Bitácora de Traslados Externos'}
          </h3>
          <div className="portal-filtros-card" style={{ padding: 0, border: 0 }}>
            <label htmlFor="buscar-bitacora" className="portal-filtros-etiqueta">Buscar en la bitácora</label>
            <div className="portal-filtros-buscador">
              <Search size={16} aria-hidden="true" className="portal-filtros-buscador-icono" />
              <Input
                id="buscar-bitacora"
                type="search"
                className="portal-input"
                placeholder={verMovimientosCaniles ? 'Animal, canil o responsable…' : 'Animal, destino o estado…'}
                value={busqueda}
                onChange={e => {
                  const texto = e.target.value;
                  setBusquedasBitacora(prev => ({ ...prev, [tab]: texto }));
                }}
              />
            </div>
          </div>
          <div className="canil-bitacora-registros" role="region" aria-label="Registros de la bitácora" tabIndex={0}>
            <table aria-labelledby="caniles-bitacora-titulo" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'var(--portal-surface-muted)', borderBottom: 'var(--portal-border-emphasis) solid var(--portal-border)', textAlign: 'left', color: 'var(--portal-text-muted)' }}>
                  <th style={{ padding: '10px' }}>Fecha</th>
                  <th style={{ padding: '10px' }}>Animal</th>
                  {!verMovimientosCaniles && <th style={{ padding: '10px' }}>Tipo</th>}
                  <th style={{ padding: '10px' }}>{verMovimientosCaniles ? 'Origen / Destino' : 'Destino'}</th>
                  <th style={{ padding: '10px' }}>Responsable</th>
                  <th style={{ padding: '10px' }}>Estado</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {registrosBitacora.length === 0 ? (
                  <tr>
                    <td colSpan={verMovimientosCaniles ? 6 : 7} style={{ textAlign: 'center', padding: '24px', color: 'var(--portal-text-muted)' }}>
                      {cargando
                        ? 'Cargando bitácora…'
                        : consulta && historial.length > 0
                          ? 'No se encontraron registros para esta búsqueda.'
                        : verMovimientosCaniles
                          ? 'Aún no hay movimientos de caniles registrados.'
                          : 'Aún no hay traslados externos registrados.'}
                    </td>
                  </tr>
                ) : (
                  registrosBitacora.map(t => {
                    const estadoInfo = ESTADOS_TRASLADO[t.estado] || {
                      etiqueta: t.estado.replace('_', ' '),
                      bg: '#e9eaed',
                      color: 'var(--portal-text-muted)'
                    };

                    return (
                      <tr
                        key={t.id}
                        onClick={() => abrirDetalleTraslado(t)}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--portal-surface-muted)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                        style={{ borderBottom: 'var(--portal-border-emphasis) solid #f0f1f3', cursor: 'pointer' }}
                      >
                        <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>
                          {formatearFecha(t.fechaRegistro)}
                        </td>
                        <td style={{ padding: '10px', fontWeight: '700' }}>{t.animal?.nombre || '—'}</td>
                        {!verMovimientosCaniles && (
                          <td style={{ padding: '10px' }}>{ETIQUETAS_TIPO_TRASLADO[t.tipo] || t.tipo}</td>
                        )}
                        <td style={{ padding: '10px' }}>
                          {verMovimientosCaniles ? (
                            <span>{t.canilOrigen?.nombre || 'Ingreso'} → {t.canilDestino?.nombre || '—'}</span>
                          ) : (
                            <span><strong>{t.destinoNombre || '—'}</strong> {t.destinoContacto ? `(${t.destinoContacto})` : ''}</span>
                          )}
                        </td>
                        <td style={{ padding: '10px' }}>{t.responsable?.nombre || '—'}</td>
                        <td style={{ padding: '10px' }}>
                          <span style={{
                            fontSize: '0.72rem', fontWeight: '700', padding: '3px 8px', borderRadius: '6px',
                            background: estadoInfo.bg, color: estadoInfo.color
                          }}>
                            {estadoInfo.etiqueta}
                          </span>
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <Button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              abrirDetalleTraslado(t);
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--portal-primary)',
                              fontWeight: '700',
                              fontSize: '0.76rem',
                              cursor: 'pointer',
                              padding: '4px 2px',
                              minHeight: 0
                            }}
                          >
                            {!verMovimientosCaniles && esDireccion && t.estado === 'PENDIENTE_APROBACION' ? 'Revisar' : 'Ver detalle'} →
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB SOLICITAR TRASLADO EXTERNO */}
      {tab === 'solicitar' && (
        <div style={{ background: 'var(--portal-surface)', borderRadius: '16px', border: 'var(--portal-border-emphasis) solid var(--portal-border)', padding: '26px', margin: '0 auto' }}>
          <h3 style={{ margin: '0 0 8px', color: '#1f2430' }}>Solicitar Traslado Externo</h3>
          <p style={{ color: 'var(--portal-text-muted)', fontSize: '0.84rem', margin: '0 0 18px' }}>
            Para traslados hacia protectoras aliadas u hogares temporales. Requiere aprobación obligatoria por Dirección.
          </p>

          {errorExterno && (
            <div style={{ background: '#ffe4e6', color: '#b82d44', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', fontSize: '0.82rem' }}>
              {errorExterno}
            </div>
          )}

          <form noValidate onSubmit={trasladoForm.handleSubmit(handleSolicitarExterno)}>
            <div style={{ marginBottom: '12px' }}>
              <label htmlFor="traslado-externo-animal" style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: 'var(--portal-text-muted)', marginBottom: '4px' }}>
                Animal a Trasladar *
              </label>
              <AnimalSelect
                id="traslado-externo-animal"
                describir={resumirAnimalEnCanil}
                animales={animales}
                value={trasladoExterno.animalId}
                onChange={(animalId) => setTrasladoExterno(prev => ({ ...prev, animalId }))}
                placeholder="— Seleccionar animal —"
                searchPlaceholder="Buscar por nombre, especie o canil..."
              />
              <ErrorCampo error={trasladoForm.errorCampo("animalId")} />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label htmlFor={trasladoForm.idCampo('tipo')} style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: 'var(--portal-text-muted)', marginBottom: '4px' }}>
                Tipo de Destino *
              </label>
              <Input as="select" {...trasladoForm.campo("tipo")}
                value={trasladoExterno.tipo}
                onChange={e => setTrasladoExterno({ ...trasladoExterno, tipo: e.target.value })}
                style={{ width: '100%', padding: '9px', borderRadius: '8px', border: 'var(--portal-border-emphasis) solid var(--portal-border)' }}
              >
                <option value="PROTECTORA_ALIADA">Protectora Aliada</option>
                <option value="HOGAR_TEMPORAL">Hogar Temporal (Acogida)</option>
              </Input>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label htmlFor={trasladoForm.idCampo('destinoNombre')} style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: 'var(--portal-text-muted)', marginBottom: '4px' }}>
                Nombre de la Protectora o Encargado del Hogar *
              </label>
              <Input {...trasladoForm.campo("destinoNombre")}
                type="text"
                required
                placeholder="Ej: Fundación Patitas Felices / Familia Morales"
                value={trasladoExterno.destinoNombre}
                onChange={e => setTrasladoExterno({ ...trasladoExterno, destinoNombre: e.target.value })}
                style={{ width: '100%', padding: '9px', borderRadius: '8px', border: 'var(--portal-border-emphasis) solid var(--portal-border)', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label htmlFor={trasladoForm.idCampo('destinoContacto')} style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: 'var(--portal-text-muted)', marginBottom: '4px' }}>
                  Teléfono / Contacto
                </label>
                <Input {...trasladoForm.campo("destinoContacto")}
                  type="text"
                  placeholder="+56 9 ..."
                  value={trasladoExterno.destinoContacto}
                  onChange={e => setTrasladoExterno({ ...trasladoExterno, destinoContacto: e.target.value })}
                  style={{ width: '100%', padding: '9px', borderRadius: '8px', border: 'var(--portal-border-emphasis) solid var(--portal-border)', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label htmlFor={trasladoForm.idCampo('destinoDireccion')} style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: 'var(--portal-text-muted)', marginBottom: '4px' }}>
                  Dirección
                </label>
                <Input {...trasladoForm.campo("destinoDireccion")}
                  type="text"
                  placeholder="Comuna, calle..."
                  value={trasladoExterno.destinoDireccion}
                  onChange={e => setTrasladoExterno({ ...trasladoExterno, destinoDireccion: e.target.value })}
                  style={{ width: '100%', padding: '9px', borderRadius: '8px', border: 'var(--portal-border-emphasis) solid var(--portal-border)', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label htmlFor={trasladoForm.idCampo('destinoEmail')} style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--portal-text-muted)', marginBottom: '4px' }}>
                Correo electrónico del destino (opcional)
              </label>
              <Input {...trasladoForm.campo('destinoEmail')} type="email" autoComplete="email"
                value={trasladoExterno.destinoEmail}
                onChange={event => trasladoForm.cambiar('destinoEmail', event.target.value)}
                style={{ padding: '9px', borderRadius: '8px', border: 'var(--portal-border-emphasis) solid var(--portal-border)' }} />
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label htmlFor={trasladoForm.idCampo('motivo')} style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: 'var(--portal-text-muted)', marginBottom: '4px' }}>
                Motivo del Traslado (Obligatorio) *
              </label>
              <Input as="textarea" {...trasladoForm.campo("motivo")}
                required
                rows={3}
                placeholder="Ej: Sobrecupo temporal / Necesidad de socialización en hogar / Tratamiento especializado en protectora"
                value={trasladoExterno.motivo}
                onChange={e => setTrasladoExterno({ ...trasladoExterno, motivo: e.target.value })}
                style={{ width: '100%', padding: '9px', borderRadius: '8px', border: 'var(--portal-border-emphasis) solid var(--portal-border)', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <Button
                type="button"
                onClick={() => setTab('mapa')}
                style={{ padding: '9px 16px', background: 'transparent', border: 'var(--portal-border-emphasis) solid var(--portal-border)', borderRadius: '8px', cursor: 'pointer' }}
              >
                Cancelar
              </Button>
              <Button cargando={trasladoForm.isSubmitting}
                type="submit"
                style={{ padding: '9px 20px', background: 'var(--portal-primary)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
              >
                Registrar Solicitud
              </Button>
            </div>
          </form>
        </div>
      )}

      </div>

      {/* MODAL DETALLE DE TRASLADO */}
      {detalleTraslado && (
        <Modal onClose={cerrarDetalleTraslado} bloqueado={procesandoAprobacion} aria-labelledby="titulo-detalle-traslado"
          papel={{ style: {
            background: 'var(--portal-surface)', borderRadius: '18px', padding: '26px', width: '100%', maxWidth: '720px',
            maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 12px 36px rgba(20,24,32,0.2)',
            boxSizing: 'border-box'
          } }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '18px' }}>
              <div>
                <h3 id="titulo-detalle-traslado" style={{ margin: '0 0 4px', color: '#1f2430', display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <ClipboardList size={19} aria-hidden="true" /> Detalle del traslado
                </h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--portal-text-muted)' }}>
                  Solicitud de traslado
                </p>
              </div>
              <span style={{
                fontSize: '0.74rem', fontWeight: '800', padding: '6px 10px', borderRadius: '8px',
                background: detalleEstadoInfo.bg, color: detalleEstadoInfo.color, whiteSpace: 'nowrap'
              }}>
                {detalleEstadoInfo.etiqueta}
              </span>
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--portal-surface-muted)',
              borderRadius: '12px', padding: '12px', marginBottom: '18px'
            }}>
              <div style={{
                width: '54px', height: '54px', borderRadius: '10px', background: '#e9eaed',
                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0
              }}>
                {detalleTraslado.animal?.fotoUrl ? (
                  <img
                    src={detalleTraslado.animal.fotoUrl}
                    alt={detalleTraslado.animal.nombre}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <PawPrint size={26} color="#7c8592" aria-hidden="true" />
                )}
              </div>
              <div>
                <div style={{ fontWeight: '800', fontSize: '1rem', color: '#1f2430' }}>
                  {detalleTraslado.animal?.nombre || 'Animal'}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--portal-text-muted)', marginTop: '2px' }}>
                  {detalleTraslado.animal && resumirAnimalEnCanil(detalleTraslado.animal)}
                </div>
              </div>
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '14px', marginBottom: '18px'
            }}>
              <div>
                <span style={{ display: 'block', fontSize: '0.68rem', fontWeight: '800', color: 'var(--portal-text-muted)', textTransform: 'uppercase' }}>
                  Fecha de registro
                </span>
                <div style={{ fontSize: '0.86rem', color: '#1f2430', marginTop: '3px' }}>
                  {formatearFecha(detalleTraslado.fechaRegistro, true)}
                </div>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.68rem', fontWeight: '800', color: 'var(--portal-text-muted)', textTransform: 'uppercase' }}>
                  Tipo de traslado
                </span>
                <div style={{ fontSize: '0.86rem', color: '#1f2430', marginTop: '3px' }}>
                  {ETIQUETAS_TIPO_TRASLADO[detalleTraslado.tipo] || detalleTraslado.tipo.replace(/_/g, ' ')}
                </div>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.68rem', fontWeight: '800', color: 'var(--portal-text-muted)', textTransform: 'uppercase' }}>
                  Responsable
                </span>
                <div style={{ fontSize: '0.86rem', color: '#1f2430', marginTop: '3px' }}>
                  {detalleTraslado.responsable?.nombre || '—'}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--portal-text-muted)' }}>
                  {detalleTraslado.responsable?.rolEtiqueta || ''}
                </div>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.68rem', fontWeight: '800', color: 'var(--portal-text-muted)', textTransform: 'uppercase' }}>
                  Estado
                </span>
                <div style={{ fontSize: '0.86rem', color: '#1f2430', marginTop: '3px' }}>
                  {detalleEstadoInfo.etiqueta}
                </div>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.68rem', fontWeight: '800', color: 'var(--portal-text-muted)', textTransform: 'uppercase' }}>
                  Origen
                </span>
                <div style={{ fontSize: '0.86rem', color: '#1f2430', marginTop: '3px' }}>
                  {detalleOrigen}
                </div>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.68rem', fontWeight: '800', color: 'var(--portal-text-muted)', textTransform: 'uppercase' }}>
                  Destino
                </span>
                <div style={{ fontSize: '0.86rem', color: '#1f2430', marginTop: '3px' }}>
                  {detalleDestino}
                </div>
              </div>
            </div>

            {!detalleEsInterno && (detalleTraslado.destinoContacto || detalleTraslado.destinoDireccion || detalleTraslado.destinoEmail) && (
              <div style={{
                background: 'var(--portal-surface-muted)', borderRadius: '10px', padding: '12px 14px',
                marginBottom: '18px', fontSize: '0.82rem', color: '#555e6d'
              }}>
                <strong style={{ display: 'block', marginBottom: '4px', color: '#1f2430' }}>Datos del destino externo</strong>
                {detalleTraslado.destinoContacto && <div>Contacto: {detalleTraslado.destinoContacto}</div>}
                {detalleTraslado.destinoEmail && <div style={{ overflowWrap: 'anywhere' }}>Correo electrónico: {detalleTraslado.destinoEmail}</div>}
                {detalleTraslado.destinoDireccion && <div>Dirección: {detalleTraslado.destinoDireccion}</div>}
              </div>
            )}

            <div style={{ marginBottom: '18px' }}>
              <span style={{ display: 'block', fontSize: '0.68rem', fontWeight: '800', color: 'var(--portal-text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                Motivo del traslado
              </span>
              <div style={{
                background: 'var(--portal-surface)', border: 'var(--portal-border-emphasis) solid var(--portal-border)', borderRadius: '10px',
                padding: '12px 14px', fontSize: '0.86rem', color: '#1f2430',
                whiteSpace: 'pre-wrap', lineHeight: 1.5
              }}>
                {detalleTraslado.motivo || 'Sin motivo registrado.'}
              </div>
            </div>

            <div style={{ background: 'var(--portal-surface-muted)', borderRadius: '12px', padding: '16px', marginBottom: '18px' }}>
              <h4 style={{ margin: '0 0 10px', fontSize: '0.9rem', color: '#1f2430', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldCheck size={16} aria-hidden="true" /> Aprobación de Dirección
              </h4>

              {detalleTraslado.estado === 'PENDIENTE_APROBACION' ? (
                puedeAprobarTraslado ? (
                  <>
                    <p style={{ margin: '0 0 10px', fontSize: '0.82rem', color: 'var(--portal-text-muted)' }}>
                      Revisa la solicitud y registra tu decisión.
                    </p>
                    <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: '700', color: 'var(--portal-text-muted)', marginBottom: '4px' }}>
                      Comentario o motivo de rechazo
                    </label>
                    <Input as="textarea" {...aprobacionForm.campo('comentario')}
                      rows={3}
                      value={aprobacionForm.valores.comentario}
                      onChange={e => aprobacionForm.cambiar('comentario', e.target.value)}
                      disabled={procesandoAprobacion}
                      placeholder="Opcional para aprobar. Obligatorio para rechazar."
                      style={{
                        width: '100%', padding: '9px', borderRadius: '8px', border: 'var(--portal-border-emphasis) solid var(--portal-border)',
                        boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit'
                      }}
                    />
                    <div style={{ fontSize: '0.72rem', color: 'var(--portal-text-muted)', marginTop: '5px' }}>
                      El comentario es obligatorio solo si rechazas la solicitud.
                    </div>
                  </>
                ) : (
                  <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--portal-text-muted)' }}>
                    Esta solicitud está pendiente de revisión por Dirección.
                  </p>
                )
              ) : detalleTraslado.aprobadoPor ? (
                <div style={{ fontSize: '0.84rem', color: '#1f2430' }}>
                  <div>
                    <strong>{detalleTraslado.estado === 'RECHAZADO' ? 'Rechazado por' : 'Aprobado por'}:</strong>{' '}
                    {detalleTraslado.aprobadoPor.nombre}
                  </div>
                  <div style={{ color: 'var(--portal-text-muted)', marginTop: '3px' }}>
                    {formatearFecha(detalleTraslado.fechaAprobacion, true)}
                  </div>
                  {detalleTraslado.comentarioAprobacion && (
                    <div style={{ marginTop: '8px' }}>
                      <strong>Comentario:</strong> {detalleTraslado.comentarioAprobacion}
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--portal-text-muted)' }}>
                  Movimiento interno registrado automáticamente. No requiere aprobación.
                </p>
              )}
            </div>

            {errorAprobacion && (
              <div style={{
                background: '#ffe4e6', color: '#b82d44', padding: '10px 14px',
                borderRadius: '8px', marginBottom: '14px', fontSize: '0.82rem'
              }}>
                {errorAprobacion}
              </div>
            )}

            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              gap: '10px', flexWrap: 'wrap', paddingTop: '16px', borderTop: 'var(--portal-border-emphasis) solid #f0f1f3'
            }}>
              <Button
                type="button"
                onClick={cerrarDetalleTraslado}
                style={{
                  padding: '9px 16px', background: 'transparent', border: 'var(--portal-border-emphasis) solid var(--portal-border)',
                  borderRadius: '8px', cursor: 'pointer', fontWeight: '600'
                }}
              >
                Cerrar
              </Button>

              {puedeAprobarTraslado && (
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <Button
                    type="button"
                    disabled={procesandoAprobacion}
                    onClick={() => enviarAprobacion(false)}
                    style={{
                      padding: '9px 16px', background: '#ffe4e6', border: 'var(--portal-border-emphasis) solid #f3c9c4',
                      color: '#b82d44', borderRadius: '8px', fontWeight: '700',
                      cursor: procesandoAprobacion ? 'not-allowed' : 'pointer',
                      opacity: procesandoAprobacion ? 0.65 : 1
                    }}
                  >
                    {procesandoAprobacion ? 'Procesando...' : 'Rechazar solicitud'}
                  </Button>
                  <Button
                    type="button"
                    disabled={procesandoAprobacion}
                    onClick={() => enviarAprobacion(true)}
                    style={{
                      padding: '9px 20px', background: 'var(--portal-primary)', border: 'none',
                      color: '#fff', borderRadius: '8px', fontWeight: '700',
                      cursor: procesandoAprobacion ? 'not-allowed' : 'pointer',
                      opacity: procesandoAprobacion ? 0.65 : 1
                    }}
                  >
                    {procesandoAprobacion ? 'Procesando...' : 'Aprobar traslado'}
                  </Button>
                </div>
              )}
            </div>
          </Modal>
      )}

      {selectedCanil && <CanilDetalleModal key={selectedCanil.id} c={selectedCanil} user={user} animales={animales} caniles={caniles} sectores={sectoresExistentes} recargar={cargarDatos}
        cerrar={() => seleccionar(null)} eliminar={() => { seleccionar(null); setEliminarCanil(selectedCanil); setEliminarConfirmOpen(true); }}/>}
      {/* MODAL CONFIRMACIÓN ELIMINAR CANIL */}
      {eliminarConfirmOpen && (
        <Modal onClose={() => setEliminarConfirmOpen(false)} nombre="Eliminar canil" bloqueado={eliminandoCanil} cerrarAlPulsarFondo={false}
          papel={{ style: {
            background: 'var(--portal-surface)', borderRadius: '18px', padding: '26px', width: '100%', maxWidth: '480px',
            boxShadow: '0 12px 36px rgba(20,24,32,0.2)'
          } }}>
            <h3 style={{ margin: '0 0 6px', color: '#b82d44', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '7px' }}>
              <Trash2 size={20} aria-hidden="true" /> Eliminar Canil
            </h3>
            <p style={{ color: 'var(--portal-text-muted)', fontSize: '0.88rem', margin: '0 0 18px' }}>
              ¿Estás seguro de que deseas eliminar este canil? Esta acción no se puede deshacer.
            </p>
            <div style={{ background: 'var(--portal-surface-muted)', padding: '12px 16px', borderRadius: '10px', marginBottom: '20px', fontSize: '0.86rem', color: '#555e6d' }}>
              <strong>Canil a eliminar:</strong> {eliminarCanil?.nombre || ''}
            </div>
            {eliminandoCanil && (
              <div style={{ textAlign: 'center', color: 'var(--portal-text-muted)', fontSize: '0.84rem' }}>Eliminando...</div>
            )}
            {!eliminandoCanil && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <Button
                  onClick={() => setEliminarConfirmOpen(false)}
                  style={{ padding: '9px 16px', background: 'transparent', border: 'var(--portal-border-emphasis) solid var(--portal-border)', borderRadius: '8px', cursor: 'pointer' }}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirmarEliminarCanil}
                  style={{ padding: '9px 20px', background: '#b82d44', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
                >
                  Eliminar Canil
                </Button>
              </div>
            )}
          </Modal>
      )}
    </div>
  );
}
