import React, { useMemo } from 'react';
import {
  Table, TableHead, TableBody, TableRow, TableCell,
  Chip, Skeleton, Typography, Box,
} from '@mui/material';
import LayersIcon from '@mui/icons-material/Layers';

function formatQty(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return n.toFixed(2);
}

function normalizeWall(wall) {
  if (!wall) return null;
  const price = Number(wall.price);
  const quantity = Number(wall.quantity ?? wall.qty);
  if (!Number.isFinite(price) || !Number.isFinite(quantity)) return null;
  return { ...wall, price, quantity };
}

function LiquidityWallsPanel({ bookMetrics, loading }) {
  const walls = useMemo(() => {
    const backendWalls = bookMetrics?.walls ?? {};
    return {
      bids: (backendWalls.bidWalls ?? []).map(normalizeWall).filter(Boolean).slice(0, 5),
      asks: (backendWalls.askWalls ?? []).map(normalizeWall).filter(Boolean).slice(0, 5),
    };
  }, [bookMetrics]);

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
        <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>No backend walls</Typography>
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
