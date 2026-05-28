import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  Box, Card, CardHeader, CardContent, Chip,
  Slider, Typography,
} from '@mui/material';
import { formatTrade } from '../../domain/tape.model';
import { safeNumber } from '../../utils/marketDataGuards';

const SIZE_COLOR = { large: '#FBBF24', medium: undefined, small: undefined };
const SIDE_COLOR = { buy: '#16A34A', sell: '#EF4444' };

/**
 * Tape Reader — scrolling list of recent aggressor trades with:
 *   – Color-coded buy (green) / sell (red) rows
 *   – Large-order highlighting (amber)
 *   – Minimum notional filter (USD value)
 *   – Auto-scroll that pauses on hover
 *   – Notional column ($value)
 *   – Block trade badge
 *
 * Props:
 *   trades  – raw trade objects from useFuturesAssetRealtime recentTrades
 *   height  – panel content height in px (default 320)
 */
function TapeReaderPanel({ trades = [], height = 320 }) {
  const [minNotional, setMinNotional] = useState(0);
  const [paused, setPaused]           = useState(false);
  const [scrollTop, setScrollTop]     = useState(0);
  const listRef                       = useRef(null);
  const ROW_HEIGHT = 20;
  const OVERSCAN = 12;

  // Compute recent quantities for size classification
  const recentQtys = useMemo(
    () => trades.slice(0, 100).map((t) => safeNumber(t.qty ?? t.quantity, 0)),
    [trades]
  );

  // Build enriched entries
  const entries = useMemo(() => {
    return trades
      .slice(0, 160)
      .map((t) => {
        const fmt      = formatTrade(t, recentQtys);
        const notional = fmt.price * fmt.qty;
        return { ...fmt, notional };
      })
      .filter((e) => e.notional >= minNotional);
  }, [trades, recentQtys, minNotional]);

  const visibleCount = Math.max(10, Math.ceil(height / ROW_HEIGHT) + OVERSCAN * 2);
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(entries.length, startIndex + visibleCount);
  const visibleEntries = entries.slice(startIndex, endIndex);
  const padTop = startIndex * ROW_HEIGHT;
  const padBottom = Math.max(0, (entries.length - endIndex) * ROW_HEIGHT);

  // Auto-scroll to top on new trade (unless paused)
  useEffect(() => {
    if (!paused && listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [entries, paused]);

  const maxNotional = useMemo(() => {
    const vals = entries.slice(0, 100).map((e) => e.notional);
    return Math.ceil(Math.max(...vals, 100));
  }, [entries]);

  return (
    <Card variant="outlined" sx={{ mt: 1 }}>
      <CardHeader
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="subtitle2">Tape Reader</Typography>
            <Chip label={`${entries.length}`} size="small" />
          </Box>
        }
        sx={{ py: 0.5, px: 1.5 }}
        subheader={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ minWidth: 80 }}>
              Min $: {minNotional > 0 ? `$${minNotional.toLocaleString()}` : 'all'}
            </Typography>
            <Slider
              size="small"
              min={0}
              max={maxNotional}
              step={Math.max(1, Math.floor(maxNotional / 100))}
              value={minNotional}
              onChange={(_, v) => setMinNotional(v)}
              sx={{ width: 100 }}
            />
          </Box>
        }
      />
      <CardContent
        sx={{ p: 0, '&:last-child': { pb: 0 } }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* Column headers */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '52px 36px 1fr 1fr 72px',
            px: 1, py: '2px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            color: '#6B7280',
            fontSize: '0.65rem',
          }}
        >
          <span>Time</span>
          <span>Side</span>
          <span style={{ textAlign: 'right', paddingRight: 4 }}>Price</span>
          <span style={{ textAlign: 'right' }}>Qty</span>
          <span style={{ textAlign: 'right' }}>Notional</span>
        </Box>
        <Box
          ref={listRef}
          onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
          sx={{ height, overflowY: 'auto', fontSize: '0.7rem', fontFamily: 'monospace' }}
        >
          {padTop > 0 && <Box sx={{ height: padTop }} />}
          {visibleEntries.map((entry, idx) => (
            <TapeRow key={`${entry.time}-${startIndex + idx}`} entry={entry} />
          ))}
          {padBottom > 0 && <Box sx={{ height: padBottom }} />}
        </Box>
      </CardContent>
    </Card>
  );
}

function TapeRow({ entry }) {
  const isBlock = entry.sizeClass === 'large';
  const bg = isBlock
    ? 'rgba(251,191,36,0.08)'
    : entry.side === 'buy'
      ? 'rgba(22,163,74,0.06)'
      : 'rgba(239,68,68,0.06)';

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '52px 36px 1fr 1fr 72px',
        alignItems: 'center',
        px: 1, py: '1px',
        height: 20,
        boxSizing: 'border-box',
        background: bg,
        borderBottom: '1px solid rgba(255,255,255,0.03)',
        '&:hover': { background: 'rgba(255,255,255,0.05)' },
      }}
    >
      <Typography variant="inherit" color="text.secondary">{entry.timeStr}</Typography>

      <Box sx={{ textAlign: 'center', fontWeight: 700, color: SIDE_COLOR[entry.side], letterSpacing: '0.02em' }}>
        {entry.side === 'buy' ? 'B' : 'S'}
      </Box>

      <Typography variant="inherit" sx={{ textAlign: 'right', pr: 1 }}>
        {entry.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
      </Typography>

      <Typography
        variant="inherit"
        sx={{
          textAlign: 'right',
          fontWeight: isBlock ? 700 : 400,
          color: SIZE_COLOR[entry.sizeClass] ?? SIDE_COLOR[entry.side],
        }}
      >
        {entry.qty.toFixed(3)}
        {isBlock && <span style={{ marginLeft: 2, fontSize: '0.6rem', color: '#FBBF24' }}>★</span>}
      </Typography>

      <Typography variant="inherit" sx={{ textAlign: 'right', color: '#6B7280' }}>
        ${entry.notional >= 1000
          ? `${(entry.notional / 1000).toFixed(1)}k`
          : entry.notional.toFixed(0)}
      </Typography>
    </Box>
  );
}

export default React.memo(TapeReaderPanel);
