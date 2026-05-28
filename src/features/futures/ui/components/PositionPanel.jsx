import React from 'react';
import {
  Card, CardHeader, CardContent,
  Table, TableHead, TableRow, TableCell, TableBody,
  Chip, Skeleton, Typography, Box,
} from '@mui/material';
import TrendingUpIcon   from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import { formatPrice, formatQty, formatPercent } from '../../utils/formatters';

/**
 * Table of open futures positions (paper/demo data).
 * compact=true hides the Card wrapper (used inside bottom tabs panel).
 */
export default function PositionPanel({ positions = [], loading, compact = false }) {
  if (loading) {
    return (
      <Card variant="outlined">
        <CardContent><Skeleton height={100} /></CardContent>
      </Card>
    );
  }

  const inner = (
    <CardContent sx={{ pt: 0, px: 0 }}>
        {positions.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 1 }}>
            No open positions
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                {['Symbol', 'Side', 'Size', 'Entry', 'Mark', 'PnL', 'ROE'].map((h) => (
                  <TableCell key={h} sx={{ border: 0, py: 0.5, fontSize: 11, color: 'text.secondary' }}>
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {positions.map((pos, i) => {
                const isLong = parseFloat(pos.positionAmt) > 0;
                const pnl    = parseFloat(pos.unrealizedProfit || 0);
                const pnlColor = pnl >= 0 ? 'success.main' : 'error.main';
                return (
                  <TableRow key={i} hover sx={{ '&:hover': { bgcolor: '#0F1923' } }}>
                    <TableCell sx={{ border: 0, py: 0.3, fontSize: 11 }}>{pos.symbol}</TableCell>
                    <TableCell sx={{ border: 0, py: 0.3 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                        {isLong
                          ? <TrendingUpIcon   sx={{ fontSize: 11, color: 'success.main' }} />
                          : <TrendingDownIcon sx={{ fontSize: 11, color: 'error.main'   }} />}
                        <Typography sx={{ fontSize: 11, fontWeight: 600, color: isLong ? 'success.main' : 'error.main' }}>
                          {isLong ? 'LONG' : 'SHORT'}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ border: 0, py: 0.3, fontSize: 11 }}>
                      {formatQty(Math.abs(pos.positionAmt), 3)}
                    </TableCell>
                    <TableCell sx={{ border: 0, py: 0.3, fontSize: 11 }}>
                      {formatPrice(pos.entryPrice, 2)}
                    </TableCell>
                    <TableCell sx={{ border: 0, py: 0.3, fontSize: 11 }}>
                      {formatPrice(pos.markPrice, 2)}
                    </TableCell>
                    <TableCell sx={{ border: 0, py: 0.3, fontSize: 11, color: pnlColor, fontWeight: 600 }}>
                      {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
                    </TableCell>
                    <TableCell sx={{ border: 0, py: 0.3, fontSize: 11, color: pnlColor }}>
                      {formatPercent(pos.roe, 2)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
  );

  if (compact) return inner;

  return (
    <Card variant="outlined">
      <CardHeader
        title={`Positions (${positions.length})`}
        titleTypographyProps={{ variant: 'subtitle2' }}
        sx={{ pb: 0 }}
      />
      {inner}
    </Card>
  );
}
