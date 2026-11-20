import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

// Pila de modales abiertos: la tecla Escape solo cierra el que está encima.
const pilaModales = [];

const SELECTOR_FOCO = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Ventana modal centrada. Se cierra con el botón X, la tecla Escape o un clic fuera del recuadro.
 * Mientras `bloqueado` sea verdadero (por ejemplo, al guardar) no se puede cerrar.
 */
export default function ModalAdopcion({
  titulo,
  subtitulo,
  icono,
  onClose,
  ancho = 'md',
  bloqueado = false,
  tono,
  children
}) {
  const idTitulo = useId();
  const dialogoRef = useRef(null);
  const cierreRef = useRef(onClose);
  const bloqueadoRef = useRef(bloqueado);
  const clicInicioFuera = useRef(false);

  cierreRef.current = onClose;
  bloqueadoRef.current = bloqueado;

  useEffect(() => {
    const entrada = {};
    pilaModales.push(entrada);

    const elementoPrevio = document.activeElement;
    const desbordamientoPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const alPresionarTecla = (evento) => {
      if (evento.key !== 'Escape' || pilaModales[pilaModales.length - 1] !== entrada) return;
      if (evento.defaultPrevented) return;
      evento.preventDefault();
      if (!bloqueadoRef.current) cierreRef.current?.();
    };

    document.addEventListener('keydown', alPresionarTecla);
    dialogoRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', alPresionarTecla);
      const posicion = pilaModales.indexOf(entrada);
      if (posicion >= 0) pilaModales.splice(posicion, 1);
      document.body.style.overflow = desbordamientoPrevio;
      if (elementoPrevio && typeof elementoPrevio.focus === 'function' && document.contains(elementoPrevio)) {
        elementoPrevio.focus();
      }
    };
  }, []);

  const mantenerFoco = (evento) => {
    if (evento.key !== 'Tab' || !dialogoRef.current) return;
    const enfocables = [...dialogoRef.current.querySelectorAll(SELECTOR_FOCO)];
    if (!enfocables.length) return;
    const primero = enfocables[0];
    const ultimo = enfocables[enfocables.length - 1];
    if (evento.shiftKey && (document.activeElement === primero || document.activeElement === dialogoRef.current)) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primero.focus();
    }
  };

  return createPortal(
    <div
      className="adop-modal-fondo"
      onMouseDown={(evento) => { clicInicioFuera.current = evento.target === evento.currentTarget; }}
      onClick={(evento) => {
        const cerrarPorFondo = clicInicioFuera.current && evento.target === evento.currentTarget;
        clicInicioFuera.current = false;
        if (cerrarPorFondo && !bloqueadoRef.current) cierreRef.current?.();
      }}
    >
      <div
        ref={dialogoRef}
        className={`adop-modal adop-modal-${ancho}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        tabIndex={-1}
        onKeyDown={mantenerFoco}
      >
        <div className="adop-modal-encabezado">
          <div style={{ minWidth: 0 }}>
            <h3 id={idTitulo} className="adop-modal-titulo" style={tono ? { color: tono } : undefined}>
              {icono}
              <span>{titulo}</span>
            </h3>
            {subtitulo && <p className="adop-modal-subtitulo">{subtitulo}</p>}
          </div>
          <button
            type="button"
            className="adop-modal-cerrar"
            onClick={() => { if (!bloqueadoRef.current) cierreRef.current?.(); }}
            disabled={bloqueado}
            aria-label="Cerrar ventana"
            title="Cerrar"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="adop-modal-cuerpo">{children}</div>
      </div>
    </div>,
    document.body
  );
}
