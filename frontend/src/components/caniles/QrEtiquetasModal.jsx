import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { imagenQr, urlCanil } from '../../utils/qr';
import { formatearDiasEnCanil } from '../../utils/dias';

export default function QrEtiquetasModal({ todos, sector, filtrados, cerrar }) {
  const [alcance, elegir] = useState('todos');
  const [nombres, mostrarNombres] = useState(true);
  const [dias, mostrarDias] = useState(true);
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
  const etiquetas = lista.map(c => <article className="qr-etiqueta" key={c.id}>
    <small>Refugio Huellas Sin Hogar</small><h3>{c.codigo} · {c.nombre}</h3>
    <div>{c.sector} · {c.tipo} · Capacidad: {c.capacidad}</div>
    <div>{!c.animales.length ? 'Libre' : nombres ? 'Ocupa: ' + c.animales.map(a => a.nombre).join(', ') : c.animales.length + ' ocupantes'}</div>
    {dias && <small>{c.animales.map(a => (nombres ? a.nombre + ' · ' : '') + formatearDiasEnCanil(a.diasEnCanil)).join(' / ')}</small>}
    {imagenes[c.id] && <img src={imagenes[c.id]} alt={'QR de ' + c.nombre} />}
    <small>Escanea para ver este canil</small><hr/>
  </article>);
  return <Modal nombre="Etiquetas QR" onClose={cerrar} papel={{ style: { padding: 24, maxWidth: 800 } }}>
    <h2>Etiquetas QR</h2>
    <label>Imprimir <select value={alcance} onChange={e => elegir(e.target.value)}><option value="todos">Todos los caniles</option><option value="sector">Sector actual</option><option value="filtro">Filtro actual</option></select></label>
    <label><input type="checkbox" checked={nombres} onChange={e => mostrarNombres(e.target.checked)}/> Incluir ocupantes</label>
    <label><input type="checkbox" checked={dias} onChange={e => mostrarDias(e.target.checked)}/> Incluir días</label>
    {['localhost','127.0.0.1'].includes(new URL(urlCanil(1)).hostname) && <p>La URL del QR apunta a localhost; desde un celular no abrirá. Configura VITE_PUBLIC_APP_URL con el dominio público.</p>}
    {error && <p role="alert">{error}</p>}
    <div className="qr-preview">{etiquetas}</div>
    <Button variante="secundaria" onClick={cerrar}>Cerrar</Button> <Button variante="principal" disabled={!lista.length || lista.some(c => !imagenes[c.id])} onClick={() => window.print()}>Imprimir</Button>
    {createPortal(<div className="qr-print-area" aria-hidden="true">{Array.from({length: Math.ceil(etiquetas.length/8)}, (_,i) => <div className="qr-hoja" key={i}>{etiquetas.slice(i*8,i*8+8)}</div>)}</div>, document.body)}
  </Modal>;
}
