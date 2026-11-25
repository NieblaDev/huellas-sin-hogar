import React, { useEffect, useState } from 'react';
import Button from '../ui/Button';
import { obtenerHistorialCanil } from '../../services/canil.service';
const fecha = x => x ? new Date(x).toLocaleDateString('es-CL') : 'Actual';
export default function HistorialCanil({ id }) {
  const [data, guardar] = useState(null), [cursor, pagina] = useState(null), [error, fallo] = useState(''), [cargando, cargar] = useState(true);
  useEffect(() => {
    let vigente = true;
    cargar(true);
    obtenerHistorialCanil(id, { cursor }).then(async r => {
      if (!r.ok) throw Error('No se pudo cargar el historial.');
      const d = await r.json();
      if (vigente) guardar(prev => ({ ...d, movimientos: [...(cursor ? prev.movimientos : []), ...d.movimientos] }));
    }).catch(e => vigente && fallo(e.message)).finally(() => vigente && cargar(false));
    return () => { vigente = false; };
  }, [id, cursor]);
  if (error) return <p role="alert">{error}</p>;
  if (!data) return <p role="status">Cargando historial…</p>;
  return <section className="canil-historial"><p className="canil-modal-chip">{data.resumen.residentes} residentes · {data.resumen.movimientos} movimientos · Estadía promedio de {data.resumen.promedioDias} días</p>
    <h3>Movimientos</h3>{!data.movimientos.length && <p>Este canil todavía no tiene movimientos registrados.</p>}
    <ol>{data.movimientos.map(m => <li key={m.id}><small>{fecha(m.fecha)} · {m.responsable.nombre}</small><strong>{m.animal.nombre}</strong>{m.origen || 'Sin canil'} → {m.destino || 'Sin canil'}<span>{m.motivo}</span></li>)}</ol>
    {data.paginacion.nextCursor && <Button variante="secundaria" disabled={cargando} onClick={() => pagina(data.paginacion.nextCursor)}>Cargar más</Button>}
    <h3>Estadías</h3><ul>{data.estadias.map((e,i) => <li key={i}>{e.animal.nombre} · {fecha(e.desde)} – {fecha(e.hasta)} · {e.dias} días</li>)}</ul>
    <h3>Cuarentenas</h3><ul>{data.cuarentenas.map(q => <li key={q.id}>{q.animal.nombre} · {fecha(q.fechaInicio)} – {fecha(q.fechaFinReal)} · {q.estado} · {q.motivo}{q.observaciones && <span className="canil-nota">{q.observaciones}</span>}</li>)}</ul>
  </section>;
}
