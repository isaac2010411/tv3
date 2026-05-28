import React from 'react';
import { Typography, LinearProgress, Chip, Box, Skeleton, Tooltip } from '@mui/material';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import { calcOrderBookImbalance } from '../../domain/orderbook.model';
import { safeNumber, safeFormat } from '../../utils/marketDataGuards';

/**
 * Returns label / color based on [-1, 1] imbalance.
 * Thresholds:  ±0.60 = strongly directional, ±0.30 = directional, else neutral.
 */
function getLabel(value) {
  if      (value >  0.60) return { label: 'Strong Buy',  color: 'success' };
  else if (value >  0.30) return { label: 'Bullish',     color: 'success' };
  else if (value < -0.60) return { label: 'Strong Sell', color: 'error'   };
  else if (value < -0.30) return { label: 'Bearish',     color: 'error'   };
  else                    return { label: 'Neutral',     color: 'default'  };
}

/**
 * Horizontal gauge showing bid-vs-ask volume imbalance.
 *
 * Props:
 *   orderBook – processed OrderBook
 *   depth     – how many levels to use (default 20)
 *   loading   – show skeleton
 */
function OrderBookImbalance({ orderBook, depth = 20, loading }) {
  // calcOrderBookImbalance already guards against invalid books and returns 0
  const raw       = calcOrderBookImbalance(orderBook, depth);
  const imbalance = safeNumber(raw, 0);          // extra NaN guard
  const { label, color } = getLabel(imbalance);

  // progress bar maps [-1, 1] → [0%, 100%]
  const progress = ((imbalance + 1) / 2) * 100;

  // Per-side volume for display
  const bids       = orderBook?.bids?.slice(0, depth) ?? [];
  const asks       = orderBook?.asks?.slice(0, depth) ?? [];
  const bidVolume  = bids.reduce((s, l) => s + (l.quantity ?? 0), 0);
  const askVolume  = asks.reduce((s, l) => s + (l.quantity ?? 0), 0);
  const totalVol   = bidVolume + askVolume;
  const bidPct     = totalVol > 0 ? ((bidVolume / totalVol) * 100) : 50;
  const askPct     = totalVol > 0 ? ((askVolume / totalVol) * 100) : 50;

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
        <Tooltip title={`Imbalance: ${safeFormat(imbalance, 3)} (top ${depth} levels)`} placement="top">
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
          Δ {safeFormat(imbalance * 100, 1)}%
        </Typography>
        <Typography sx={{ fontSize: 10, color: 'success.main', fontWeight: 600 }}>
          Buy {safeFormat(bidPct, 1)}%
        </Typography>
      </Box>
    </Box>
  );
}

export default React.memo(OrderBookImbalance);
