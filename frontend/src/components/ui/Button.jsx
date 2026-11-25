import React, { forwardRef } from 'react';
import MuiButton from '@mui/material/Button';

const variantes = { principal: 'contained', secundaria: 'outlined', texto: 'text' };

const Button = forwardRef(function Button({ children, variante, cargando = false, disabled, sx, ...props }, ref) {
  return (
    <MuiButton
      ref={ref}
      type="button"
      variant={variantes[variante] ?? 'text'}
      disableElevation
      disableRipple
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      sx={[
        { textTransform: 'none' },
        variante === 'secundaria' && { borderWidth: 'var(--portal-border-emphasis, 2px)' },
        !variante && {
          minWidth: 0, padding: 0, color: 'inherit', lineHeight: 'inherit', font: 'inherit',
          verticalAlign: 'baseline', '&:hover': { backgroundColor: 'transparent' }
        },
        ...(Array.isArray(sx) ? sx : [sx])
      ]}
      {...props}
    >
      {children}
    </MuiButton>
  );
});

export default Button;
