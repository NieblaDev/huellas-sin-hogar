import React, { forwardRef } from 'react';
import Dialog from '@mui/material/Dialog';

const Modal = forwardRef(function Modal({
  children, open = true, onClose, bloqueado = false, cerrarAlPulsarFondo = true,
  papel = {}, className, nombre, fondo, style, ...props
}, ref) {
  const scrollInterior = papel.style?.overflow !== 'visible' &&
    !papel.className?.split(/\s+/).some(clase => ['adop-modal', 'canil-modal', 'perfil-modal'].includes(clase));
  const estiloPapel = scrollInterior
    ? { ...papel.style, padding: 0, overflow: 'hidden' }
    : papel.style;
  return (
    <Dialog
      ref={ref}
      open={open}
      onClose={(event, reason) => {
        if (!bloqueado && (reason !== 'backdropClick' || cerrarAlPulsarFondo)) onClose?.(event, reason);
      }}
      disableEscapeKeyDown={bloqueado}
      maxWidth={false}
      className={['portal-staff', className].filter(Boolean).join(' ')}
      style={{ backgroundColor: 'transparent', ...style }}
      slotProps={{
        paper: { 'aria-label': nombre, ...papel, style: estiloPapel },
        backdrop: { sx: { backgroundColor: fondo ?? 'rgba(20,24,32,0.55)' } }
      }}
      sx={{ '& .MuiDialog-container': { padding: '16px' }, '& .MuiDialog-paper': { margin: 0 } }}
      {...props}
    >
      {scrollInterior ? (
        <div className="portal-modal-contenido" style={{ padding: papel.style?.padding }}>
          {children}
        </div>
      ) : children}
    </Dialog>
  );
});

export default Modal;
