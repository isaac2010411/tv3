import React from 'react';
import { Box, Typography, Chip } from '@mui/material';
import { detectWalls } from '../../domain/orderbook.model';

function getNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function sumRecentDelta(cvdHistory = [], limit = 10) {
  return cvdHistory.slice(-limit).reduce((acc, item) => {
    const value = getNumber(item?.delta);
    return acc + (value ?? 0);
  }, 0);
}

function normalizeImbalance(raw) {
  const value = getNumber(raw);
  if (value == null) return null;
  if (Math.abs(value) > 1) return value / 100;
  return value;
}

function lastImbalance(imbalanceHistory = []) {
  const last = imbalanceHistory[imbalanceHistory.length - 1];
  if (!last) return null;

  const direct = normalizeImbalance(
    last?.imbalance ??
    last?.imbalanceRatio ??
    last?.imbalancePercent ??
    last?.orderBookImbalance ??
    last?.value ??
    last?.ratio ??
    last?.score
  );

  if (direct != null) return direct;

  const buy = getNumber(last?.buyRatio ?? last?.bidRatio ?? last?.buyPercent ?? last?.bidPercent);
  const sell = getNumber(last?.sellRatio ?? last?.askRatio ?? last?.sellPercent ?? last?.askPercent);

  if (buy != null && sell != null) {
    const normalizedBuy = Math.abs(buy) > 1 ? buy / 100 : buy;
    const normalizedSell = Math.abs(sell) > 1 ? sell / 100 : sell;
    return normalizedBuy - normalizedSell;
  }

  const bidVolume = getNumber(last?.bidVolume ?? last?.buyVolume ?? last?.bidQty ?? last?.buyQty);
  const askVolume = getNumber(last?.askVolume ?? last?.sellVolume ?? last?.askQty ?? last?.sellQty);

  if (bidVolume != null && askVolume != null && bidVolume + askVolume > 0) {
    return (bidVolume - askVolume) / (bidVolume + askVolume);
  }

  return null;
}

function calculateOrderBookImbalance(orderBook, depth = 10) {
  const bids = Array.isArray(orderBook?.bids) ? orderBook.bids.slice(0, depth) : [];
  const asks = Array.isArray(orderBook?.asks) ? orderBook.asks.slice(0, depth) : [];

  const bidQty = bids.reduce((acc, level) => acc + (getNumber(level?.quantity ?? level?.qty ?? level?.size) ?? 0), 0);
  const askQty = asks.reduce((acc, level) => acc + (getNumber(level?.quantity ?? level?.qty ?? level?.size) ?? 0), 0);

  if (bidQty + askQty <= 0) return null;
  return (bidQty - askQty) / (bidQty + askQty);
}

/**
 * Returns the wall closest to mid on the given side, or null if there are none.
 * Uses the same 5×median algorithm as the backend domain service.
 */
function closestWallToMid(walls, midPrice) {
  if (!walls || walls.length === 0 || midPrice == null) return null;
  return walls.reduce((best, w) => {
    if (!best) return w;
    return Math.abs(w.price - midPrice) < Math.abs(best.price - midPrice) ? w : best;
  }, null);
}

function formatCompact(value) {
  const n = getNumber(value);
  if (n == null) return '—';
  if (Math.abs(n) >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toFixed(2);
}

/** Spread threshold above which scalping signals should not be trusted (0.05% = 5 bps). */
const SPREAD_WARN_PCT  = 0.0005;
const SPREAD_ALERT_PCT = 0.002;

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

function ScalpingDecisionRibbon({ cvdHistory = [], imbalanceHistory = [], orderBook = null, spoofingCount = 0, shiftCount = 0 }) {
  const delta = sumRecentDelta(cvdHistory, 10);
  const historicalImbalance = lastImbalance(imbalanceHistory);
  const orderBookImbalance = calculateOrderBookImbalance(orderBook, 10);
  const imbalance = historicalImbalance ?? orderBookImbalance;

  // Wall detection using the domain algorithm (5× median, tactical range ±1% of mid)
  const { bidWalls, askWalls } = detectWalls(orderBook, { multiplier: 5, maxDistancePct: 0.01, depth: 100 });
  const midPrice = orderBook?.midPrice ?? null;
  const bidWall  = closestWallToMid(bidWalls, midPrice);
  const askWall  = closestWallToMid(askWalls, midPrice);

  // Spread awareness: spreadPct is (spread / midPrice) as a ratio
  const spreadPct   = orderBook?.spreadPct ?? null;
  const spreadAlert = spreadPct != null && spreadPct > SPREAD_ALERT_PCT;
  const spreadWarn  = spreadPct != null && spreadPct > SPREAD_WARN_PCT;
  const spreadTone  = spreadAlert ? 'sell' : spreadWarn ? 'warn' : 'default';
  const spreadLabel = spreadPct != null ? `${(spreadPct * 100).toFixed(4)}%` : '—';

  const deltaTone     = delta > 0 ? 'buy' : delta < 0 ? 'sell' : 'default';
  const imbalanceTone = imbalance == null ? 'default' : imbalance > 0.15 ? 'buy' : imbalance < -0.15 ? 'sell' : 'default';
  const alertTone     = spoofingCount > 0 ? 'warn' : 'default';

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
      <SignalPill label="Δ10" value={formatCompact(delta)} tone={deltaTone} />
      <SignalPill label="Imb" value={imbalance == null ? '—' : `${(imbalance * 100).toFixed(0)}%`} tone={imbalanceTone} />
      <SignalPill label="Bid Wall" value={bidWall ? `${Number(bidWall.price).toFixed(1)} / ${formatCompact(bidWall.quantity)}` : '—'} tone={bidWall ? 'buy' : 'default'} />
      <SignalPill label="Ask Wall" value={askWall ? `${Number(askWall.price).toFixed(1)} / ${formatCompact(askWall.quantity)}` : '—'} tone={askWall ? 'sell' : 'default'} />
      <SignalPill label="Spread" value={spreadLabel} tone={spreadTone} />
      <SignalPill label="Spoof" value={String(spoofingCount)} tone={alertTone} />
      <SignalPill label="Shifts" value={String(shiftCount)} tone={shiftCount > 0 ? 'warn' : 'default'} />
    </Box>
  );
}

export default React.memo(ScalpingDecisionRibbon);
