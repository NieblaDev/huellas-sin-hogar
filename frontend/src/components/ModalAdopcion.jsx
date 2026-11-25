import React, { useId } from 'react';
import { X } from 'lucide-react';
import Button from './ui/Button.jsx';
import Modal from './ui/Modal.jsx';

export default function ModalAdopcion({ titulo, subtitulo, icono, onClose, ancho = 'md', bloqueado = false, tono, children }) {
  const idTitulo = useId();

  return (
    <Modal onClose={onClose} bloqueado={bloqueado} aria-labelledby={idTitulo}
      papel={{ className: `adop-modal adop-modal-${ancho}` }}>
      <div className="adop-modal-encabezado">
        <div style={{ minWidth: 0 }}>
          <h3 id={idTitulo} className="adop-modal-titulo" style={tono ? { color: tono } : undefined}>
            {icono}
            <span>{titulo}</span>
          </h3>
          {subtitulo && <p className="adop-modal-subtitulo">{subtitulo}</p>}
        </div>
        <Button className="adop-modal-cerrar" onClick={onClose} disabled={bloqueado}
          aria-label="Cerrar ventana" title="Cerrar">
          <X size={18} aria-hidden="true" />
        </Button>
      </div>
      <div className="adop-modal-cuerpo">{children}</div>
    </Modal>
  );
}
