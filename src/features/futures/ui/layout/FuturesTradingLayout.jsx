import React from 'react';
import { Box } from '@mui/material';

export default function FuturesTradingLayout({ header, left, center, right, bottom }) {
  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: 'background.default' }}>
      {header}
      <Box sx={{ flex: 1, display: 'grid', gridTemplateColumns: '230px minmax(0, 1fr) 288px', gridTemplateRows: 'minmax(0, 1fr) 210px', overflow: 'hidden', minHeight: 0 }}>
        {left}
        {center}
        {right}
        {bottom}
      </Box>
    </Box>
  );
}
