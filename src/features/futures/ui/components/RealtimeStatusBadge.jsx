import React from 'react';
import { Chip, Box } from '@mui/material';
import WifiIcon    from '@mui/icons-material/Wifi';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import SyncIcon    from '@mui/icons-material/Sync';

const STATUS_CONFIG = {
  connected:    { label: 'Live',       color: 'success', Icon: WifiIcon,    dot: '#22C55E' },
  connecting:   { label: 'Connecting', color: 'warning', Icon: SyncIcon,    dot: '#F59E0B' },
  disconnected: { label: 'Offline',    color: 'error',   Icon: WifiOffIcon, dot: '#EF4444' },
};

/**
 * Small chip that shows the WebSocket connection status.
 * @param {'connected'|'connecting'|'disconnected'} status
 */
export default function RealtimeStatusBadge({ status = 'disconnected' }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.disconnected;
  const { Icon } = cfg;

  // animated dot for connected state
  const dot = (
    <Box component="span" sx={{ display: 'flex', alignItems: 'center', ml: 0.25 }}>
      <Box
        component="span"
        sx={{
          width: 6, height: 6,
          borderRadius: '50%',
          bgcolor: cfg.dot,
          ...(status === 'connected' && {
            animation: 'pulse 2s ease-in-out infinite',
            '@keyframes pulse': {
              '0%, 100%': { opacity: 1, transform: 'scale(1)' },
              '50%':       { opacity: 0.5, transform: 'scale(0.8)' },
            },
          }),
        }}
      />
    </Box>
  );

  return (
    <Chip
      icon={dot}
      label={cfg.label}
      color={cfg.color}
      size="small"
      variant="outlined"
      sx={{ fontSize: 10, height: 22, fontWeight: 600 }}
    />
  );
}
