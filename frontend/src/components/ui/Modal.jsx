import React, { forwardRef } from 'react';
import Dialog from '@mui/material/Dialog';

const Modal = forwardRef(function Modal({
  children, open = true, onClose, bloqueado = false, cerrarAlPulsarFondo = true,
  papel = {}, className, nombre, fondo, style, ...props
}, ref) {
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
        paper: { 'aria-label': nombre, ...papel },
        backdrop: { sx: { backgroundColor: fondo ?? 'rgba(20,24,32,0.55)' } }
      }}
      sx={{ '& .MuiDialog-container': { padding: '16px' }, '& .MuiDialog-paper': { margin: 0 } }}
      {...props}
    >
      {children}
    </Dialog>
  );
});

export default Modal;
