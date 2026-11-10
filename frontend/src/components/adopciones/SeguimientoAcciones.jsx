import React, { useRef, useState } from 'react';
import { registrarSeguimiento, reprogramarSeguimiento } from '../../api/adopciones';
import { CANALES_FORMULARIO, ahoraLocal, mensajeError } from './seguimientoConstantes';

export default function SeguimientoAcciones({ seguimiento, user, onDone, onCancel }) {
  const [accion, setAccion] = useState('REGISTRAR');
  const [fecha, setFecha] = useState(ahoraLocal);
  const [canal, setCanal] = useState('');
  const [estadoAnimal, setEstadoAnimal] = useState('');
  const [resultado, setResultado] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [fechaReprogramada, setFechaReprogramada] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const enviando = useRef(false);
  const reprogramando = accion === 'REPROGRAMAR';
  const restantes = seguimiento.limiteIntentos - seguimiento.intentosFallidos;

  const guardar = async event => {
    event.preventDefault();
    if (enviando.current) return;
    enviando.current = true; setGuardando(true); setError('');
    try {
      if (reprogramando) {
        const r = await reprogramarSeguimiento(seguimiento.id, {
          fechaIntento: new Date(fecha).toISOString(), canalContacto: canal, resultado: resultado.trim() || 'NO_RESPONDE',
          observaciones, fechaReprogramada: new Date(fechaReprogramada).toISOString(), actualizadoEn: seguimiento.actualizadoEn
        });
        onDone(r.alertaGenerada
          ? 'Se alcanzó el límite de intentos: el seguimiento quedó «Sin contacto» y se generó una alerta.'
          : 'Intento fallido registrado y seguimiento reprogramado.');
      } else {
        await registrarSeguimiento(seguimiento.id, {
          fecha: new Date(fecha).toISOString(), canalContacto: canal, estadoAnimal, resultado,
          ...(observaciones.trim() && { observaciones }), actualizadoEn: seguimiento.actualizadoEn
        });
        onDone('Seguimiento registrado correctamente.');
      }
    } catch (err) {
      setError(mensajeError(err));
    } finally { enviando.current = false; setGuardando(false); }
  };

  return <form onSubmit={guardar} className="adopciones-card seguimiento-panel" aria-label="Registrar seguimiento">
    <fieldset disabled={guardando}>
      <legend>Seguimiento #{seguimiento.id} · {seguimiento.adopcion.animal.nombre}</legend>
      {seguimiento.alertaSinContacto && <p className="adopciones-error" role="alert">Este caso está «Sin contacto»: se agotaron los {seguimiento.limiteIntentos} intentos. Si logras contactar al adoptante, puedes registrar el resultado.</p>}
      <div className="adopciones-grid">
        <label>¿Qué vas a registrar?
          <select value={accion} onChange={e => { setAccion(e.target.value); setError(''); }}>
            <option value="REGISTRAR">Contacto realizado (resultado)</option>
            {seguimiento.estado !== 'SIN_CONTACTO' && <option value="REPROGRAMAR">Intento fallido y reprogramación</option>}
          </select>
        </label>
        <label>Responsable<input value={user?.nombre || ''} readOnly aria-readonly="true" /></label>
        <label>{reprogramando ? 'Fecha y hora del intento' : 'Fecha y hora del contacto'}<input type="datetime-local" step="1" required value={fecha} onChange={e => setFecha(e.target.value)} /></label>
        <label>Canal de contacto
          <select required value={canal} onChange={e => setCanal(e.target.value)}>
            <option value="">Selecciona un canal</option>
            {Object.entries(CANALES_FORMULARIO).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>
      {reprogramando ? <>
        <p className="adopciones-muted">Intentos fallidos: {seguimiento.intentosFallidos} de {seguimiento.limiteIntentos}. {restantes <= 1 ? 'Este intento alcanzará el límite y el caso pasará a «Sin contacto».' : `Quedan ${restantes} intentos antes de marcar «Sin contacto».`}</p>
        <div className="adopciones-grid">
          <label>Motivo del intento fallido<input maxLength={100} placeholder="Ej.: No responde, buzón de voz" value={resultado} onChange={e => setResultado(e.target.value)} /></label>
          <label>Nueva fecha y hora programada<input type="datetime-local" step="1" required value={fechaReprogramada} onChange={e => setFechaReprogramada(e.target.value)} /></label>
        </div>
        <label>Observaciones del intento<textarea required minLength={3} maxLength={4000} value={observaciones} onChange={e => setObservaciones(e.target.value)} /></label>
      </> : <>
        <label>Estado del animal<textarea required minLength={3} maxLength={4000} value={estadoAnimal} onChange={e => setEstadoAnimal(e.target.value)} /></label>
        <label>Resultado del seguimiento<input required minLength={3} maxLength={100} placeholder="Ej.: Favorable, requiere nueva visita" value={resultado} onChange={e => setResultado(e.target.value)} /></label>
        <label>Observaciones (opcional)<textarea maxLength={4000} value={observaciones} onChange={e => setObservaciones(e.target.value)} /></label>
      </>}
      {error && <p className="adopciones-error" role="alert">{error}</p>}
      <div className="adopciones-toolbar">
        <button className="primary" type="submit">{guardando ? 'Guardando…' : reprogramando ? 'Registrar intento y reprogramar' : 'Registrar seguimiento'}</button>
        <button type="button" onClick={onCancel}>Cerrar</button>
        {error && <button type="button" onClick={() => onDone('Detalle actualizado.')}>Recargar lista</button>}
      </div>
    </fieldset>
  </form>;
}
