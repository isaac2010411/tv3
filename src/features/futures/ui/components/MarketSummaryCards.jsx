import React from 'react';
import { Grid, Card, CardContent, Typography, Skeleton } from '@mui/material';
import { formatPrice, formatPercent, formatCompact } from '../../utils/formatters';

function MetricCard({ label, value, color, loading }) {
  return (
    <Card variant="outlined">
      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
        <Typography variant="caption" color="text.secondary" display="block">
          {label}
        </Typography>
        {loading
          ? <Skeleton width="60%" height={24} />
          : (
            <Typography variant="body1" fontWeight={600} color={color || 'text.primary'}>
              {value}
            </Typography>
          )}
      </CardContent>
    </Card>
  );
}

/**
 * Row of summary metric cards: lastPrice, 24h change, volume, OI, funding.
 */
export default function MarketSummaryCards({ context, realtimeTicker, loading }) {
  const lastPrice          = realtimeTicker?.close ?? realtimeTicker?.lastPrice ?? context?.lastPrice;
  const priceChangePercent = realtimeTicker?.priceChangePercent ?? context?.priceChangePercent;
  const volume             = realtimeTicker?.volume             ?? context?.volume;
  const openInterest       = context?.openInterest;
  const fundingRate        = realtimeTicker?.fundingRate        ?? context?.fundingRate;

  const pctVal    = parseFloat(priceChangePercent);
  const changeColor = pctVal >= 0 ? 'success.main' : 'error.main';

  return (
    <Grid container spacing={1.5}>
      <Grid item xs={6} sm={4} md={2}>
        <MetricCard label="Last Price" value={formatPrice(lastPrice, 2)} loading={loading} />
      </Grid>
      <Grid item xs={6} sm={4} md={2}>
        <MetricCard
          label="24h Change"
          value={formatPercent(pctVal / 100, 2)}
          color={changeColor}
          loading={loading}
        />
      </Grid>
      <Grid item xs={6} sm={4} md={2}>
        <MetricCard label="24h Volume" value={formatCompact(volume)} loading={loading} />
      </Grid>
      <Grid item xs={6} sm={4} md={2}>
        <MetricCard label="Open Interest" value={formatCompact(openInterest)} loading={loading} />
      </Grid>
      <Grid item xs={6} sm={4} md={2}>
        <MetricCard
          label="Funding Rate"
          value={formatPercent(fundingRate, 4)}
          color={parseFloat(fundingRate) >= 0 ? 'success.main' : 'error.main'}
          loading={loading}
        />
      </Grid>
    </Grid>
  );
}
