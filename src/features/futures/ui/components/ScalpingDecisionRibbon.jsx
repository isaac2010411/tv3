import React from 'react';
import { Box, Typography, Chip } from '@mui/material';

function getNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatCompact(value) {
  const n = getNumber(value);
  if (n == null) return '-';
  if (Math.abs(n) >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toFixed(2);
}

function SignalPill({ label, value, tone = 'default' }) {
  const color = tone === 'buy' ? 'success' : tone === 'sell' ? 'error' : tone === 'warn' ? 'warning' : 'default';

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
      <Typography sx={{ fontSize: 10, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
        {label}
      </Typography>
      <Chip
        label={value}
        color={color}
        size="small"
        variant={tone === 'default' ? 'outlined' : 'filled'}
        sx={{ height: 20, fontSize: 10, fontWeight: 800, borderRadius: '6px' }}
      />
    </Box>
  );
}

function wallLabel(wall) {
  if (!wall) return '-';
  const price = getNumber(wall.price);
  const qty = getNumber(wall.quantity ?? wall.qty);
  if (price == null || qty == null) return '-';
  return `${price.toFixed(1)} / ${formatCompact(qty)}`;
}

function ScalpingDecisionRibbon({ decisionTape = null }) {
  const delta = getNumber(decisionTape?.deltaRecent);
  const imbalance = getNumber(decisionTape?.imbalance);
  const spreadPct = getNumber(decisionTape?.spreadPct);
  const spreadState = decisionTape?.spreadState;
  const spoofingCount = Number.isFinite(Number(decisionTape?.spoofingCount)) ? Number(decisionTape.spoofingCount) : 0;
  const shiftCount = Number.isFinite(Number(decisionTape?.liquidityShiftCount)) ? Number(decisionTape.liquidityShiftCount) : 0;

  const deltaTone = delta == null ? 'default' : delta > 0 ? 'buy' : delta < 0 ? 'sell' : 'default';
  const imbalanceTone = imbalance == null ? 'default' : imbalance > 0.15 ? 'buy' : imbalance < -0.15 ? 'sell' : 'default';
  const spreadTone = spreadState === 'alert' ? 'sell' : spreadState === 'warn' ? 'warn' : 'default';
  const spreadLabel = spreadPct != null ? `${(spreadPct * 100).toFixed(4)}%` : '-';

  return (
    <Box
      sx={{
        height: 30,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 1.5,
        borderBottom: '1px solid',
        borderColor: 'divider',
        bgcolor: '#070B10',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <Typography sx={{ fontSize: 10, fontWeight: 900, color: 'primary.main', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
        Decision Tape
      </Typography>
      <SignalPill label="D10" value={formatCompact(delta)} tone={deltaTone} />
      <SignalPill label="Imb" value={imbalance == null ? '-' : `${(imbalance * 100).toFixed(0)}%`} tone={imbalanceTone} />
      <SignalPill label="Bid Wall" value={wallLabel(decisionTape?.nearestBidWall)} tone={decisionTape?.nearestBidWall ? 'buy' : 'default'} />
      <SignalPill label="Ask Wall" value={wallLabel(decisionTape?.nearestAskWall)} tone={decisionTape?.nearestAskWall ? 'sell' : 'default'} />
      <SignalPill label="Spread" value={spreadLabel} tone={spreadTone} />
      <SignalPill label="Spoof" value={String(spoofingCount)} tone={spoofingCount > 0 ? 'warn' : 'default'} />
      <SignalPill label="Shifts" value={String(shiftCount)} tone={shiftCount > 0 ? 'warn' : 'default'} />
    </Box>
  );
}

export default React.memo(ScalpingDecisionRibbon);
