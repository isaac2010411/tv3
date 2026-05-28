import React from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from './theme';
import FuturesAssetDashboard from './features/futures/ui/pages/FuturesAssetDashboard';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <FuturesAssetDashboard />
    </ThemeProvider>
  );
}

export default App;
