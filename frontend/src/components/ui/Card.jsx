import React, { forwardRef } from 'react';
import MuiCard from '@mui/material/Card';

const Card = forwardRef(function Card({ children, variante = 'plana', sx, ...props }, ref) {
  return (
    <MuiCard ref={ref} elevation={0} variant={variante === 'borde' ? 'outlined' : 'elevation'}
      sx={[
        { overflow: 'visible' },
        variante === 'borde' && { borderWidth: 'var(--portal-border-emphasis, 2px)' },
        ...(Array.isArray(sx) ? sx : [sx])
      ]} {...props}>
      {children}
    </MuiCard>
  );
});

export default Card;
