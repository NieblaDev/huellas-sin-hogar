import React from 'react';
import { Check, Trash2, X } from 'lucide-react';
import Button from './ui/Button.jsx';

export function AccionesNotificacion({ titulo, leida, marcar, descartar }) {
  return (
    <div className="notificacion-acciones">
      {leida ? (
        <small className="notificacion-leida"><Check size={14} aria-hidden="true" /> Leída</small>
      ) : (
        <Button variante="texto" size="small" onClick={marcar}>Marcar como leída</Button>
      )}
      <Button variante="texto" size="small" sx={{ minWidth: 32, height: 32 }}
        aria-label={'Descartar notificación: ' + titulo} title="Descartar notificación" onClick={descartar}>
        <X size={16} aria-hidden="true" />
      </Button>
    </div>
  );
}

export function EliminarNotificaciones({ onClick }) {
  return (
    <div className="notificaciones-pie">
      <Button variante="texto" size="small" color="error" startIcon={<Trash2 size={15} />} onClick={onClick}>
        Eliminar todas
      </Button>
    </div>
  );
}
