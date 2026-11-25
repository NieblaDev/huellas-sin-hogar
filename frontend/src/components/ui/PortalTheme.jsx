import React from 'react';
import { createTheme, StyledEngineProvider, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

const theme = createTheme({
  palette: {
    primary: { main: '#3f6c52' },
    error: { main: '#b43730' },
    background: { default: '#f4f6f8', paper: '#ffffff' },
    text: { primary: '#1a2420', secondary: '#4f5d66' },
    divider: '#e8ebef'
  },
  typography: { fontFamily: 'inherit' },
  components: {
    MuiOutlinedInput: {
      styleOverrides: {
        notchedOutline: { borderWidth: 'var(--portal-border-emphasis, 2px)' }
      }
    }
  }
});

export default function PortalTheme({ children }) {
  return (
    <StyledEngineProvider injectFirst>
      <ThemeProvider theme={theme}><CssBaseline />{children}</ThemeProvider>
    </StyledEngineProvider>
  );
}
