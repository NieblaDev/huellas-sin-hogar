import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, CircleCheck, TriangleAlert, X } from 'lucide-react';

const FeedbackContext = createContext(null);

export const usePortalFeedback = () => useContext(FeedbackContext);

function Confirmacion({ solicitud, onResolve }) {
  const dialogo = useRef(null);

  useEffect(() => {
    const elemento = dialogo.current;
    elemento.showModal();
    return () => elemento.close();
  }, []);

  const responder = decision => {
    dialogo.current.close();
    onResolve(decision);
  };

  const { titulo, mensaje, accion, peligro } = solicitud;
  return (
    <dialog
      ref={dialogo}
      className="portal-confirmacion"
      aria-labelledby="portal-confirmacion-titulo"
      aria-describedby="portal-confirmacion-mensaje"
      onCancel={event => { event.preventDefault(); responder(false); }}
    >
      <h2 id="portal-confirmacion-titulo">{titulo}</h2>
      <p id="portal-confirmacion-mensaje">{mensaje}</p>
      <div className="portal-confirmacion-acciones">
        <button type="button" className="portal-btn portal-btn-secondary" onClick={() => responder(false)}>Cancelar</button>
        <button type="button" className={`portal-btn ${peligro ? 'portal-btn-danger' : 'portal-btn-primary'}`} onClick={() => responder(true)}>{accion}</button>
      </div>
    </dialog>
  );
}

function Aviso({ aviso, onDismiss }) {
  const { id, mensaje, tipo } = aviso;
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(id), tipo === 'error' ? 9000 : 6000);
    return () => window.clearTimeout(timer);
  }, [id, onDismiss, tipo]);

  const Icono = tipo === 'error' ? TriangleAlert : tipo === 'exito' ? CircleCheck : Bell;
  return (
    <div className={`portal-aviso portal-aviso-${tipo}`}>
      <div className="portal-aviso-contenido" role={tipo === 'error' ? 'alert' : 'status'}>
        <Icono size={18} aria-hidden="true" />
        <span>{mensaje}</span>
      </div>
      <button type="button" aria-label="Cerrar aviso" onClick={() => onDismiss(id)}><X size={16} aria-hidden="true" /></button>
    </div>
  );
}

export default function PortalFeedback({ children }) {
  const [avisos, setAvisos] = useState([]);
  const [solicitud, setSolicitud] = useState(null);
  const contador = useRef(0);
  const resolver = useRef(null);

  const avisar = useCallback((mensaje, tipo = 'info') => {
    const id = ++contador.current;
    setAvisos(actuales => [...actuales.slice(-3), { id, mensaje, tipo }]);
  }, []);

  const cerrarAviso = useCallback(id => setAvisos(actuales => actuales.filter(aviso => aviso.id !== id)), []);

  const confirmar = useCallback(opciones => {
    if (resolver.current) return Promise.resolve(false);
    return new Promise(resolve => {
      resolver.current = resolve;
      setSolicitud(opciones);
    });
  }, []);

  const resolverConfirmacion = aceptada => {
    const resolverActual = resolver.current;
    resolver.current = null;
    setSolicitud(null);
    resolverActual?.(aceptada);
  };

  useEffect(() => () => {
    resolver.current?.(false);
    resolver.current = null;
  }, []);

  const feedback = useMemo(() => ({ avisar, confirmar }), [avisar, confirmar]);

  return (
    <FeedbackContext.Provider value={feedback}>
      {children}
      <div className="portal-avisos" aria-label="Avisos">
        {avisos.map(aviso => <Aviso key={aviso.id} aviso={aviso} onDismiss={cerrarAviso} />)}
      </div>
      {solicitud && <Confirmacion solicitud={solicitud} onResolve={resolverConfirmacion} />}
    </FeedbackContext.Provider>
  );
}
