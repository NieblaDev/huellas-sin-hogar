import React, { useEffect, useState } from 'react';
import SolicitudForm from './SolicitudForm';
import { obtenerSolicitud, eliminarSolicitud } from '../../api/adopciones';
import { ESTADOS, fechaLocal } from './SolicitudesLista';

export default function SolicitudDetalle({ id }) {
  const [editando, setEditando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [errorAccion, setErrorAccion] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [recarga, setRecarga] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError(''); setData(null);
    obtenerSolicitud(id, controller.signal).then(setData)
      .catch(err => { if (!controller.signal.aborted) setError(err.message); });
    return () => controller.abort();
  }, [id, recarga]);

  if (error) return <div className="adopciones-card"><p role="alert" className="adopciones-error">{error}</p><button onClick={() => setRecarga(k => k + 1)}>Reintentar</button></div>;
  if (!data) return <p role="status">Cargando detalle…</p>;
  const { solicitud, antecedentes } = data;
  const postulante = solicitud.datosPostulante;
  if (editando) return <SolicitudForm solicitud={solicitud} onCancel={() => setEditando(false)} onSuccess={() => { setEditando(false); setMensaje('Cambios guardados correctamente.'); setRecarga(k => k + 1); }} />;
  const eliminar = async () => {
    setEliminando(true); setErrorAccion('');
    try { await eliminarSolicitud(id, solicitud.actualizadoEn); setConfirmar(false); setMensaje('Solicitud eliminada de forma lógica; queda cancelada y conserva su historial.'); setRecarga(k => k + 1); }
    catch (err) { setErrorAccion(err.message); }
    finally { setEliminando(false); }
  };
  return <article className="adopciones-card">
    <h3>Solicitud #{solicitud.id} · {ESTADOS[solicitud.estado]}</h3>
    {mensaje && <p role="status" className="adopciones-success">{mensaje}</p>}
    {errorAccion && <p role="alert" className="adopciones-error">{errorAccion}</p>}
    {solicitud.estado === 'RECIBIDA' && <div className="adopciones-toolbar">
      <button onClick={() => setEditando(true)} disabled={eliminando}>Editar solicitud</button>
      <button onClick={() => setConfirmar(true)} disabled={eliminando}>Eliminar solicitud</button>
    </div>}
    {confirmar && <div className="adopciones-alert" role="alert">
      <p>¿Eliminar esta solicitud? Quedará cancelada y conservará su historial en Auditoría.</p>
      <button onClick={eliminar} disabled={eliminando}>{eliminando ? 'Eliminando…' : 'Confirmar eliminación'}</button>
      <button onClick={() => setConfirmar(false)} disabled={eliminando}>Volver</button>
    </div>}
    <div className="adopciones-grid">
      <div><h4>Datos del postulante al registrar</h4><dl>
        <dt>Nombre</dt><dd>{postulante.nombre}</dd>
        <dt>{postulante.tipoIdentificacion}</dt><dd>{postulante.identificacion}</dd>
        <dt>Correo electrónico</dt><dd>{postulante.email}</dd>
        <dt>Teléfono</dt><dd>{postulante.telefono}</dd>
        <dt>Dirección</dt><dd>{postulante.direccion}</dd>
      </dl></div>
      <div><h4>Registro de solicitud</h4><dl>
        <dt>Animal</dt><dd>{solicitud.animal.nombre} · {solicitud.animal.especie} · #{solicitud.animal.id}</dd>
        <dt>Fecha</dt><dd>{fechaLocal(solicitud.creadoEn)}</dd>
        <dt>Responsable</dt><dd>{solicitud.registradoPor.nombre}</dd>
        <dt>Motivación y condiciones del hogar</dt><dd>{solicitud.motivacion}</dd>
      </dl></div>
    </div>
    <h4>Antecedentes actuales del postulante</h4>
    <p>{antecedentes.solicitudesActivas.length} solicitud(es) activa(s), incluida esta si corresponde.</p>
    {antecedentes.devolucionesPrevias.length === 0 ? <p>Sin devoluciones registradas.</p> : <>
      <p className="adopciones-alert">Este postulante tiene devoluciones previas.</p>
      <ul>{antecedentes.devolucionesPrevias.map(devolucion => <li key={devolucion.id}>
        {devolucion.fecha ? fechaLocal(devolucion.fecha) : 'Fecha no registrada'} — {devolucion.motivo}. Estado del animal: {devolucion.estadoAnimal}.
      </li>)}</ul>
    </>}
  </article>;
}
