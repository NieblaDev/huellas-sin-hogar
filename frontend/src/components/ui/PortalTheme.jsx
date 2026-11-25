import React from 'react';
import { createTheme, StyledEngineProvider, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

const theme = createTheme({
  palette: {
    primary: { main: '#447913' },
    error: { main: '#b43730' },
    background: { default: '#f7f8f2', paper: '#ffffff' },
    text: { primary: '#202b1a', secondary: '#505e4a' },
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
