import React, { useMemo } from 'react';
import {
  Table, TableHead, TableBody, TableRow, TableCell,
  Chip, Skeleton, Typography, Box,
} from '@mui/material';
import LayersIcon from '@mui/icons-material/Layers';
import { detectWalls } from '../../domain/orderbook.model';

function formatQty(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(2)}K`;
  return n.toFixed(2);
}

/**
 * Detects large individual levels (liquidity walls) on each side of the book.
 * Uses the same 5× median algorithm as the backend and ScalpingDecisionRibbon
 * so both panels agree on what constitutes a wall.
 * Rendered without Card wrapper — used inside the left sidebar.
 */
function LiquidityWallsPanel({ orderBook, loading, multiplier = 5 }) {
  const walls = useMemo(() => {
    const { bidWalls, askWalls } = detectWalls(orderBook, { multiplier });
    return {
      bids: [...bidWalls].sort((a, b) => b.quantity - a.quantity).slice(0, 5),
      asks: [...askWalls].sort((a, b) => b.quantity - a.quantity).slice(0, 5),
    };
  }, [orderBook, multiplier]);

  const sectionLabel = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75 }}>
      <LayersIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
      <Typography sx={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'text.secondary' }}>
        Liquidity Walls
      </Typography>
    </Box>
  );

  if (loading) {
    return <Box sx={{ p: 1.5 }}>{sectionLabel}<Skeleton height={80} /></Box>;
  }

  const isEmpty = walls.bids.length === 0 && walls.asks.length === 0;

  return (
    <Box>
      {sectionLabel}
      {isEmpty ? (
        <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>No walls detected ({multiplier}× median)</Typography>
      ) : (
        <Table size="small" sx={{ '& td,th': { px: 0.5 } }}>
          <TableHead>
            <TableRow>
              {['Side', 'Price', 'Qty'].map((h) => (
                <TableCell key={h} sx={{ border: 0, fontSize: 10, color: 'text.secondary', pb: 0.25, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {walls.bids.map((l, i) => (
              <TableRow key={`bw-${i}`} hover sx={{ '&:hover': { bgcolor: '#0F1923' } }}>
                <TableCell sx={{ border: 0, py: 0.2 }}>
                  <Chip label="BID" color="success" size="small" sx={{ height: 16, fontSize: 9 }} />
                </TableCell>
                <TableCell sx={{ border: 0, py: 0.2, color: 'success.main', fontSize: 11, fontWeight: 600 }}>
                  {l.price.toFixed(2)}
                </TableCell>
                <TableCell sx={{ border: 0, py: 0.2, fontSize: 11 }}>{formatQty(l.quantity)}</TableCell>
              </TableRow>
            ))}
            {walls.asks.map((l, i) => (
              <TableRow key={`aw-${i}`} hover sx={{ '&:hover': { bgcolor: '#0F1923' } }}>
                <TableCell sx={{ border: 0, py: 0.2 }}>
                  <Chip label="ASK" color="error" size="small" sx={{ height: 16, fontSize: 9 }} />
                </TableCell>
                <TableCell sx={{ border: 0, py: 0.2, color: 'error.main', fontSize: 11, fontWeight: 600 }}>
                  {l.price.toFixed(2)}
                </TableCell>
                <TableCell sx={{ border: 0, py: 0.2, fontSize: 11 }}>{formatQty(l.quantity)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Box>
  );
}

export default React.memo(LiquidityWallsPanel);
