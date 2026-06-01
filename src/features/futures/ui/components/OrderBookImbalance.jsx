import React from 'react';
import { Typography, LinearProgress, Chip, Box, Skeleton, Tooltip } from '@mui/material';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import { safeNumber, safeFormat } from '../../utils/marketDataGuards';

function getLabel(value) {
  if (value > 0.60) return { label: 'Strong Buy', color: 'success' };
  if (value > 0.30) return { label: 'Bullish', color: 'success' };
  if (value < -0.60) return { label: 'Strong Sell', color: 'error' };
  if (value < -0.30) return { label: 'Bearish', color: 'error' };
  return { label: 'Neutral', color: 'default' };
}

function OrderBookImbalance({ bookMetrics, depth = 20, loading }) {
  const raw = depth <= 10
    ? bookMetrics?.imbalanceTop10
    : bookMetrics?.imbalanceTop20 ?? bookMetrics?.imbalanceTop10 ?? bookMetrics?.imbalance;
  const imbalance = safeNumber(raw, 0);
  const { label, color } = getLabel(imbalance);
  const progress = ((imbalance + 1) / 2) * 100;

  const bidVolume = safeNumber(
    depth <= 10 ? bookMetrics?.bidVolumeTop10 : bookMetrics?.bidVolumeTop ?? bookMetrics?.bidVolumeTop10,
    0
  );
  const askVolume = safeNumber(
    depth <= 10 ? bookMetrics?.askVolumeTop10 : bookMetrics?.askVolumeTop ?? bookMetrics?.askVolumeTop10,
    0
  );
  const totalVol = bidVolume + askVolume;
  const bidPct = totalVol > 0 ? ((bidVolume / totalVol) * 100) : 50;
  const askPct = totalVol > 0 ? ((askVolume / totalVol) * 100) : 50;

  if (loading) {
    return <Box sx={{ p: 1 }}><Skeleton height={64} /></Box>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <ShowChartIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
          <Typography sx={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'text.secondary' }}>
            OB Imbalance
          </Typography>
        </Box>
        <Tooltip title={`Backend imbalance: ${safeFormat(imbalance, 3)} (top ${depth} levels)`} placement="top">
          <Chip label={label} color={color} size="small" sx={{ height: 18, fontSize: 10, cursor: 'default' }} />
        </Tooltip>
      </Box>

      <LinearProgress
        variant="determinate"
        value={Math.max(0, Math.min(100, progress))}
        sx={{
          height: 6,
          borderRadius: 1,
          bgcolor: '#EF444430',
          '& .MuiLinearProgress-bar': { bgcolor: '#22C55E', borderRadius: 1 },
        }}
      />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
        <Typography sx={{ fontSize: 10, color: 'error.main', fontWeight: 600 }}>
          Sell {safeFormat(askPct, 1)}%
        </Typography>
        <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>
          Delta {safeFormat(imbalance * 100, 1)}%
        </Typography>
        <Typography sx={{ fontSize: 10, color: 'success.main', fontWeight: 600 }}>
          Buy {safeFormat(bidPct, 1)}%
        </Typography>
      </Box>
    </Box>
  );
}

export default React.memo(OrderBookImbalance);
