import React from 'react';
import { Box, Typography, Chip, Skeleton, Divider } from '@mui/material';
import { formatPrice, formatPercent, formatTime } from '../../utils/formatters';
import RealtimeStatusBadge from './RealtimeStatusBadge';

function InfoBlock({ label, children, loading }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      {loading ? <Skeleton width={80} height={22} /> : children}
    </Box>
  );
}

/**
 * Top header bar with symbol info and realtime mark/index/funding data.
 */
export default function AssetHeader({ context, realtimeTicker, realtimeMarkPrice, connectionStatus, loading }) {
  const markPrice       = realtimeMarkPrice?.markPrice   ?? context?.markPrice;
  const indexPrice      = realtimeMarkPrice?.indexPrice  ?? context?.indexPrice;
  const fundingRate     = realtimeMarkPrice?.fundingRate ?? context?.fundingRate;
  const nextFundingTime = context?.nextFundingTime;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 3, py: 1 }}>
      {/* Symbol + contract type */}
      <Box>
        {loading
          ? <Skeleton width={130} height={34} />
          : (
            <Typography variant="h5" fontWeight={700} color="text.primary" lineHeight={1}>
              {context?.symbol || '—'}
            </Typography>
          )}
        <Typography variant="caption" color="text.secondary">
          {context?.contractType || ''}{context?.baseAsset ? ` · ${context.baseAsset}/${context.quoteAsset}` : ''}
        </Typography>
      </Box>

      <Chip
        label={context?.status || 'UNKNOWN'}
        color={context?.status === 'TRADING' ? 'success' : 'warning'}
        size="small"
      />

      <Divider orientation="vertical" flexItem />

      <InfoBlock label="Mark Price" loading={loading}>
        <Typography variant="body1" fontWeight={600}>
          {formatPrice(markPrice, 2)}
        </Typography>
      </InfoBlock>

      <InfoBlock label="Index Price" loading={loading}>
        <Typography variant="body1">{formatPrice(indexPrice, 2)}</Typography>
      </InfoBlock>

      <InfoBlock label="Funding Rate" loading={loading}>
        <Typography
          variant="body1"
          color={parseFloat(fundingRate) >= 0 ? 'success.main' : 'error.main'}
        >
          {formatPercent(fundingRate, 4)}
        </Typography>
      </InfoBlock>

      <InfoBlock label="Next Funding" loading={loading}>
        <Typography variant="body2">{formatTime(nextFundingTime)}</Typography>
      </InfoBlock>

      <Box sx={{ ml: 'auto' }}>
        <RealtimeStatusBadge status={connectionStatus} />
      </Box>
    </Box>
  );
}
