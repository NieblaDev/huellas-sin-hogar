import React, { useEffect, useState } from 'react';
import { listarSeguimientos } from '../../api/adopciones';
import { fechaLocal } from './SolicitudesLista';
import SeguimientoAcciones from './SeguimientoAcciones';
import DevolucionModal from './DevolucionModal';
import { CANALES, ESTADOS_SEGUIMIENTO, TIPOS_SEGUIMIENTO } from './seguimientoConstantes';

export default function SeguimientosLista({ user }) {
  const [filtros, setFiltros] = useState({ estado: '', alerta: '' });
  const [consulta, setConsulta] = useState({ pagina: 1 });
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [recarga, setRecarga] = useState(0);
  const [seleccionado, setSeleccionado] = useState(null);
  const [devolver, setDevolver] = useState(null);
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setCargando(true); setError(''); setResultado(null);
    listarSeguimientos(consulta, controller.signal)
      .then(setResultado)
      .catch(err => { if (!controller.signal.aborted) setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setCargando(false); });
    return () => controller.abort();
  }, [consulta, recarga]);

  const buscar = event => {
    event.preventDefault();
    setConsulta({ pagina: 1, ...(filtros.estado && { estado: filtros.estado }), ...(filtros.alerta && { alertaSinContacto: filtros.alerta }) });
  };
  const terminado = texto => { setMensaje(texto); setSeleccionado(null); setDevolver(null); setRecarga(k => k + 1); };
  const sinContacto = resultado?.seguimientos.filter(s => s.alertaSinContacto) || [];

  return <div className="adopciones-card">
    <h3>Seguimientos post-adopción</h3>
    <p className="adopciones-muted">Los seguimientos a los 15 y 30 días se programan automáticamente al concretar cada adopción.</p>
    <form onSubmit={buscar} className="adopciones-filtros">
      <label>Estado
        <select value={filtros.estado} onChange={e => setFiltros({ ...filtros, estado: e.target.value })}>
          <option value="">Todos</option>{Object.entries(ESTADOS_SEGUIMIENTO).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label>Alerta
        <select value={filtros.alerta} onChange={e => setFiltros({ ...filtros, alerta: e.target.value })}>
          <option value="">Todas</option><option value="true">Solo «Sin contacto»</option>
        </select>
      </label>
      <button type="submit" disabled={cargando}>Buscar</button>
    </form>
    {mensaje && <p role="status" className="adopciones-success">{mensaje}</p>}
    {cargando && <p role="status">Cargando seguimientos…</p>}
    {error && <p className="adopciones-error" role="alert">{error}</p>}
    {sinContacto.length > 0 && <p className="adopciones-error" role="alert">⚠ {sinContacto.length} caso(s) en esta página alcanzaron el límite de intentos sin respuesta («Sin contacto»). Requieren atención.</p>}
    {resultado && <>
      <p role="status">{resultado.total} seguimiento(s) encontrado(s).</p>
      {resultado.seguimientos.length > 0 && <div className="adopciones-scroll"><table>
        <thead><tr><th scope="col">Seguimiento</th><th scope="col">Animal / Adoptante</th><th scope="col">Programado</th><th scope="col">Estado</th><th scope="col">Intentos</th><th scope="col">Acción</th></tr></thead>
        <tbody>{resultado.seguimientos.map(s => <tr key={s.id} className={s.alertaSinContacto ? 'seguimiento-alerta' : undefined}>
          <td>#{s.id}<br />{TIPOS_SEGUIMIENTO[s.tipoSeguimiento]}</td>
          <td>{s.adopcion.animal.nombre}<br />{s.adopcion.postulante.nombre}</td>
          <td>{fechaLocal(s.fechaProgramada)}{s.fechaEjecucion && <><br />Realizado: {fechaLocal(s.fechaEjecucion)}</>}</td>
          <td><span className={`adopciones-badge ${s.estado.toLowerCase()}`}>{ESTADOS_SEGUIMIENTO[s.estado]}</span>
            {s.alertaSinContacto && <><br /><span className="adopciones-badge sin_contacto">⚠ Límite de intentos alcanzado</span></>}
            {s.estado === 'COMPLETADO' && <><br />{CANALES[s.canalContacto] || ''} · {s.resultado}</>}</td>
          <td>{s.intentosFallidos} / {s.limiteIntentos}</td>
          <td>
            {s.adopcion.devolucion && <span className="adopciones-muted">Adopción devuelta</span>}
            {s.estado !== 'COMPLETADO' && !s.adopcion.devolucion && <button onClick={() => { setSeleccionado(s); setMensaje(''); }} aria-label={`Registrar seguimiento ${s.id}`}>Registrar / reprogramar</button>}
            {!s.adopcion.devolucion && <button onClick={() => setDevolver(s)} aria-label={`Registrar devolución de la adopción ${s.adopcion.id}`}>Registrar devolución</button>}
          </td>
        </tr>)}</tbody>
      </table></div>}
      <div className="adopciones-toolbar" style={{ marginTop: 16 }}>
        <button disabled={resultado.pagina <= 1 || cargando} onClick={() => setConsulta({ ...consulta, pagina: resultado.pagina - 1 })}>Anterior</button>
        <span>Página {resultado.pagina} de {resultado.totalPaginas}</span>
        <button disabled={resultado.pagina >= resultado.totalPaginas || cargando} onClick={() => setConsulta({ ...consulta, pagina: resultado.pagina + 1 })}>Siguiente</button>
      </div>
    </>}
    {seleccionado && <SeguimientoAcciones key={seleccionado.id + seleccionado.actualizadoEn} seguimiento={seleccionado} user={user} onDone={terminado} onCancel={() => setSeleccionado(null)} />}
    {devolver && <DevolucionModal adopcionId={devolver.adopcion.id} animal={devolver.adopcion.animal.nombre} postulante={devolver.adopcion.postulante.nombre} onClose={() => setDevolver(null)} onDone={() => terminado('Devolución registrada. El animal volvió al refugio.')} />}
  </div>;
}
