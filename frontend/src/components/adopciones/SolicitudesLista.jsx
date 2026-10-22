import React, { useEffect, useState } from 'react';
import { listarSolicitudes } from '../../api/adopciones';

export const ESTADOS = {
  RECIBIDA: 'Recibida', EN_EVALUACION: 'En evaluación', VISITA_AGENDADA: 'Visita agendada',
  VISITA_REALIZADA: 'Visita realizada', APROBADA: 'Aprobada', RECHAZADA: 'Rechazada',
  ENTREGADA: 'Entregada', CANCELADA: 'Cancelada'
};
export const fechaLocal = fecha => new Date(fecha).toLocaleString('es-CL');

export default function SolicitudesLista({ onVer }) {
  const [filtros, setFiltros] = useState({ search: '', estado: '' });
  const [consulta, setConsulta] = useState({ pagina: 1 });
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    setCargando(true); setError(''); setResultado(null);
    listarSolicitudes(consulta, controller.signal)
      .then(setResultado)
      .catch(err => { if (!controller.signal.aborted) setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setCargando(false); });
    return () => controller.abort();
  }, [consulta]);

  const buscar = event => {
    event.preventDefault();
    setConsulta({ pagina: 1, ...(filtros.search.trim() && { search: filtros.search.trim() }), ...(filtros.estado && { estado: filtros.estado }) });
  };
  return <div className="adopciones-card">
    <form onSubmit={buscar} className="adopciones-filtros">
      <label>Buscar postulante, identificación o animal
        <input maxLength={120} value={filtros.search} onChange={e => setFiltros({ ...filtros, search: e.target.value })} />
      </label>
      <label>Estado
        <select value={filtros.estado} onChange={e => setFiltros({ ...filtros, estado: e.target.value })}>
          <option value="">Todos</option>{Object.entries(ESTADOS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <button type="submit" disabled={cargando}>Buscar</button>
    </form>
    {cargando && <p role="status">Cargando solicitudes…</p>}
    {error && <p className="adopciones-error" role="alert">{error}</p>}
    {resultado && <>
      <p role="status">{resultado.total} solicitud(es) encontrada(s).</p>
      {resultado.solicitudes.length > 0 && <div className="adopciones-scroll"><table>
        <thead><tr><th scope="col">N.º / Fecha</th><th scope="col">Postulante</th><th scope="col">Animal</th><th scope="col">Estado</th><th scope="col">Acción</th></tr></thead>
        <tbody>{resultado.solicitudes.map(solicitud => <tr key={solicitud.id}>
          <td>#{solicitud.id}<br />{fechaLocal(solicitud.creadoEn)}</td>
          <td>{solicitud.datosPostulante.nombre}<br />{solicitud.postulante.identificacion}</td>
          <td>{solicitud.animal.nombre}</td><td>{ESTADOS[solicitud.estado]}</td>
          <td><button onClick={() => onVer(solicitud.id)} aria-label={`Ver solicitud ${solicitud.id}`}>Ver detalle</button></td>
        </tr>)}</tbody>
      </table></div>}
      <div className="adopciones-toolbar" style={{ marginTop: 16 }}>
        <button disabled={resultado.pagina <= 1 || cargando} onClick={() => setConsulta({ ...consulta, pagina: resultado.pagina - 1 })}>Anterior</button>
        <span>Página {resultado.pagina} de {Math.max(1, Math.ceil(resultado.total / resultado.limite))}</span>
        <button disabled={resultado.pagina * resultado.limite >= resultado.total || cargando} onClick={() => setConsulta({ ...consulta, pagina: resultado.pagina + 1 })}>Siguiente</button>
      </div>
    </>}
  </div>;
}
