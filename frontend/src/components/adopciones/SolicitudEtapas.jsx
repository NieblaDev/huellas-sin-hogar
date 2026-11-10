import React, { useRef, useState } from 'react';
import { registrarEtapa } from '../../api/adopciones';
import { fechaLocal } from './SolicitudesLista';
import { RESULTADOS_EVALUACION, resultadoEvaluacionActual } from './flujoAdopcion';

const nombres = {
  EVALUAR: 'Registrar evaluación', AGENDAR_VISITA: 'Agendar o reprogramar visita previa', REGISTRAR_VISITA: 'Registrar visita previa realizada',
  OMITIR_VISITA: 'Omitir visita con motivo', APROBAR: 'Aprobar solicitud', RECHAZAR: 'Rechazar solicitud', CANCELAR: 'Cancelar proceso', ENTREGAR: 'Concretar adopción'
};
const opciones = solicitud => {
  if (['RECIBIDA', 'EN_EVALUACION', 'VISITA_AGENDADA', 'VISITA_REALIZADA'].includes(solicitud.estado) && resultadoEvaluacionActual(solicitud) !== 'CUMPLE') return ['EVALUAR', 'RECHAZAR'];
  switch (solicitud.estado) {
    case 'RECIBIDA': return ['EVALUAR', 'RECHAZAR'];
    case 'EN_EVALUACION': return solicitud.visitaOmitida ? ['APROBAR', 'AGENDAR_VISITA', 'REGISTRAR_VISITA', 'RECHAZAR'] : ['AGENDAR_VISITA', 'REGISTRAR_VISITA', 'OMITIR_VISITA', 'RECHAZAR'];
    case 'VISITA_AGENDADA': return ['AGENDAR_VISITA', 'REGISTRAR_VISITA', 'OMITIR_VISITA', 'RECHAZAR'];
    case 'VISITA_REALIZADA': return ['APROBAR', 'RECHAZAR'];
    case 'APROBADA': return ['ENTREGAR', 'CANCELAR'];
    default: return [];
  }
};
const ahoraLocal = () => {
  const fecha = new Date();
  return new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
};

export default function SolicitudEtapas({ solicitud, onUpdated }) {
  const disponibles = opciones(solicitud);
  const [accion, setAccion] = useState(disponibles[0] || '');
  const [fecha, setFecha] = useState(() => disponibles[0] === 'AGENDAR_VISITA' ? '' : ahoraLocal());
  const [resultadoEvaluacion, setResultadoEvaluacion] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [motivoOmision, setMotivoOmision] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const enviando = useRef(false);
  const guardar = async event => {
    event.preventDefault();
    if (enviando.current) return;
    enviando.current = true; setGuardando(true); setError('');
    try {
      await registrarEtapa(solicitud.id, {
        accion, fecha: new Date(fecha).toISOString(), observaciones, actualizadoEn: solicitud.actualizadoEn,
        ...(accion === 'OMITIR_VISITA' && { motivoOmision }),
        ...(accion === 'EVALUAR' && { resultadoEvaluacion })
      });
      onUpdated(accion === 'ENTREGAR' ? 'Adopción exitosa. El animal está adoptado y su canil quedó liberado.' : 'Progreso de la adopción actualizado.');
    } catch (err) {
      setError([err.message, ...(err.detalles || []).map(d => d.mensaje)].join(' '));
    } finally { enviando.current = false; setGuardando(false); }
  };
  return <section className="adopciones-etapas" aria-label="Etapas de la adopción">
    <h4>{disponibles.length ? 'Actualizar progreso de la adopción' : 'Historial del proceso de adopción'}</h4>
    {solicitud.estado === 'APROBADA' && <p>Aprobada, pendiente de entrega. Confirma la adopción exitosa cuando el animal haya sido entregado al adoptante.</p>}
    {solicitud.visitaOmitida && <p className="adopciones-alert">Visita omitida: {solicitud.motivoOmisionVisita}</p>}
    {solicitud.adopcion && <p className="adopciones-success">Adopción #{solicitud.adopcion.id} concretada el {fechaLocal(solicitud.adopcion.fecha)} por {solicitud.adopcion.responsable?.nombre || 'Responsable no registrado'}. Estado del animal: {solicitud.animal.estadoAdopcion === 'ADOPTADO' ? 'Adoptado' : 'En refugio'}.</p>}
    {disponibles.length > 0 && <form onSubmit={guardar}>
      <fieldset disabled={guardando}>
        <div className="adopciones-grid">
          <label>¿Qué vas a registrar?<select value={accion} onChange={e => { setAccion(e.target.value); setFecha(e.target.value === 'AGENDAR_VISITA' ? '' : ahoraLocal()); setError(''); }}>{disponibles.map(a => <option key={a} value={a}>{nombres[a]}</option>)}</select></label>
          <label>{accion === 'AGENDAR_VISITA' ? 'Fecha y hora de la visita' : 'Fecha y hora de realización'}<input type="datetime-local" step="1" required value={fecha} onChange={e => setFecha(e.target.value)} /></label>
        </div>
        {accion === 'EVALUAR' && <label>Resultado de la evaluación<select required value={resultadoEvaluacion} onChange={e => setResultadoEvaluacion(e.target.value)}>
          <option value="">Selecciona un resultado</option>
          {Object.entries(RESULTADOS_EVALUACION).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>}
        {['AGENDAR_VISITA', 'REGISTRAR_VISITA', 'OMITIR_VISITA'].includes(accion) && <p>Visita previa a la adopción: revisa el espacio, la seguridad y las condiciones de cuidado del hogar.</p>}
        {accion === 'OMITIR_VISITA' && <label>Motivo de omisión de la visita<textarea required minLength={3} maxLength={2000} value={motivoOmision} onChange={e => setMotivoOmision(e.target.value)} /></label>}
        <label>{accion === 'CANCELAR' ? 'Motivo de la cancelación' : accion === 'RECHAZAR' || (accion === 'EVALUAR' && resultadoEvaluacion === 'NO_CUMPLE') ? 'Motivo del rechazo' : accion === 'EVALUAR' && resultadoEvaluacion === 'PENDIENTE' ? 'Información pendiente' : 'Observaciones'}<textarea required minLength={3} maxLength={4000} value={observaciones} onChange={e => setObservaciones(e.target.value)} /></label>
        {accion === 'EVALUAR' && resultadoEvaluacion === 'NO_CUMPLE' && <p>Al guardar este resultado, la solicitud quedará rechazada.</p>}
        {accion === 'ENTREGAR' && <p>Al confirmar se concretará la adopción y se liberará el canil del animal.</p>}
        {accion === 'CANCELAR' && <p>Se cerrará el proceso. El animal seguirá en el refugio y conservará su canil.</p>}
        {error && <p className="adopciones-error" role="alert">{error}</p>}
        <button className="primary" type="submit">{guardando ? 'Guardando…' : accion === 'ENTREGAR' ? 'Confirmar adopción exitosa' : nombres[accion]}</button>
        {error && <button type="button" onClick={() => onUpdated('Detalle actualizado.')}>Recargar detalle</button>}
      </fieldset>
    </form>}
    {!!solicitud.etapas?.length && <div className="adopciones-scroll"><table>
      <caption>Historial de etapas</caption>
      <thead><tr><th scope="col">Acción</th><th scope="col">Fecha</th><th scope="col">Responsable</th><th scope="col">Detalle</th></tr></thead>
      <tbody>{solicitud.etapas.map(etapa => <tr key={etapa.id}>
        <td>{nombres[etapa.accion]}</td><td>{fechaLocal(etapa.fecha)}</td><td>{etapa.responsable.nombre}</td>
        <td>{etapa.resultadoEvaluacion && <strong>{RESULTADOS_EVALUACION[etapa.resultadoEvaluacion]} · </strong>}{etapa.observaciones}{etapa.motivoOmision && <p>Motivo de omisión: {etapa.motivoOmision}</p>}</td>
      </tr>)}</tbody>
    </table></div>}
  </section>;
}
