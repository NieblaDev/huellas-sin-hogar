import React, { useRef, useState } from 'react';
import { registrarDevolucion } from '../../api/adopciones';
import { ahoraLocal, mensajeError } from './seguimientoConstantes';

export default function DevolucionModal({ adopcionId, animal, postulante, onClose, onDone }) {
  const [fecha, setFecha] = useState(ahoraLocal);
  const [motivo, setMotivo] = useState('');
  const [estadoAnimal, setEstadoAnimal] = useState('');
  const [observacionesPostulante, setObservacionesPostulante] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState(false);
  const enviando = useRef(false);

  const guardar = async event => {
    event.preventDefault();
    if (enviando.current) return;
    enviando.current = true; setGuardando(true); setError('');
    try {
      await registrarDevolucion({
        adopcionId, fecha: new Date(fecha).toISOString(), motivo, estadoAnimal,
        ...(observacionesPostulante.trim() && { observacionesPostulante })
      });
      setExito(true);
    } catch (err) {
      setError(mensajeError(err));
    } finally { enviando.current = false; setGuardando(false); }
  };

  return <div className="adopciones-modal-fondo" role="presentation">
    <div className="adopciones-modal" role="dialog" aria-modal="true" aria-labelledby="devolucion-titulo">
      <h3 id="devolucion-titulo">Registrar devolución</h3>
      {exito ? <>
        <p className="adopciones-success" role="status">Devolución registrada. {animal} volvió a estar «En refugio»; su ficha y su historial se conservaron.</p>
        <p className="adopciones-alert">El historial de {postulante} quedó actualizado: las próximas solicitudes mostrarán una alerta de devolución previa.</p>
        <div className="adopciones-toolbar"><button className="primary" onClick={onDone}>Entendido</button></div>
      </> : <form onSubmit={guardar}>
        <fieldset disabled={guardando}>
          <p className="adopciones-muted">Adopción #{adopcionId} · {animal} · Adoptante: {postulante}</p>
          <p className="adopciones-alert">Al confirmar, {animal} reingresará al refugio conservando su ficha e historial, y la devolución quedará en los antecedentes de {postulante}.</p>
          <label>Fecha y hora de la devolución<input type="datetime-local" step="1" required value={fecha} onChange={e => setFecha(e.target.value)} /></label>
          <label>Motivo de la devolución<textarea required minLength={5} maxLength={4000} value={motivo} onChange={e => setMotivo(e.target.value)} /></label>
          <label>Estado del animal al reingreso<textarea required minLength={3} maxLength={4000} value={estadoAnimal} onChange={e => setEstadoAnimal(e.target.value)} /></label>
          <label>Observaciones sobre el postulante (opcional)<textarea maxLength={4000} value={observacionesPostulante} onChange={e => setObservacionesPostulante(e.target.value)} /></label>
          {error && <p className="adopciones-error" role="alert">{error}</p>}
          <div className="adopciones-toolbar">
            <button className="primary" type="submit">{guardando ? 'Guardando…' : 'Confirmar devolución y reingreso'}</button>
            <button type="button" onClick={onClose}>Cancelar</button>
          </div>
        </fieldset>
      </form>}
    </div>
  </div>;
}
