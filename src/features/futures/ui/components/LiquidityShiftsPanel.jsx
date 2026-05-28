import React from 'react';
import {
  Card, CardHeader, CardContent, Table, TableHead, TableBody,
  TableRow, TableCell, Chip, Typography, Box,
} from '@mui/material';

const TYPE_COLOR = {
  WALL_ADDED:   { bg: 'rgba(22,163,74,0.15)',  text: '#4ADE80'  },
  WALL_REMOVED: { bg: 'rgba(239,68,68,0.15)',  text: '#F87171'  },
};

/**
 * Displays live liquidity shift events (walls appearing / disappearing).
 *
 * Props:
 *   events  – array of LiquidityShiftEvent plain objects from useLiquidityData
 *   height  – scrollable table height in px (default 200)
 */
export default function LiquidityShiftsPanel({ events = [], height = 200 }) {
  return (
    <Card variant="outlined" sx={{ mt: 1 }}>
      <CardHeader
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="subtitle2">Liquidity Shifts</Typography>
            {events.length > 0 && (
              <Chip label={events.length} size="small" color="info" />
            )}
          </Box>
        }
        sx={{ py: 0.5, px: 1.5 }}
      />
      <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
        <Box sx={{ height, overflowY: 'auto' }}>
          {events.length === 0 ? (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', textAlign: 'center', py: 2 }}
            >
              No shifts detected
            </Typography>
          ) : (
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ py: 0.5, fontSize: '0.65rem' }}>Time</TableCell>
                  <TableCell sx={{ py: 0.5, fontSize: '0.65rem' }}>Type</TableCell>
                  <TableCell sx={{ py: 0.5, fontSize: '0.65rem' }}>Side</TableCell>
                  <TableCell sx={{ py: 0.5, fontSize: '0.65rem', textAlign: 'right' }}>Price</TableCell>
                  <TableCell sx={{ py: 0.5, fontSize: '0.65rem', textAlign: 'right' }}>Qty</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {events.slice(0, 50).map((ev, i) => {
                  const d = new Date(ev.timestamp);
                  const timeStr = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
                  const colors  = TYPE_COLOR[ev.type] ?? { bg: 'transparent', text: '#9CA3AF' };
                  return (
                    <TableRow key={i} sx={{ background: colors.bg }}>
                      <TableCell sx={{ py: 0.25, fontSize: '0.65rem', fontFamily: 'monospace' }}>
                        {timeStr}
                      </TableCell>
                      <TableCell sx={{ py: 0.25 }}>
                        <Chip
                          label={ev.type === 'WALL_ADDED' ? '+WALL' : '−WALL'}
                          size="small"
                          sx={{
                            height: 16,
                            fontSize: '0.6rem',
                            bgcolor: colors.bg,
                            color:   colors.text,
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ py: 0.25 }}>
                        <Chip
                          label={ev.side.toUpperCase()}
                          size="small"
                          sx={{
                            height: 16,
                            fontSize: '0.6rem',
                            bgcolor: ev.side === 'bid' ? 'rgba(22,163,74,0.2)' : 'rgba(239,68,68,0.2)',
                            color:   ev.side === 'bid' ? '#4ADE80' : '#F87171',
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ py: 0.25, fontSize: '0.65rem', textAlign: 'right', fontFamily: 'monospace' }}>
                        {parseFloat(ev.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell sx={{ py: 0.25, fontSize: '0.65rem', textAlign: 'right', fontFamily: 'monospace', color: colors.text }}>
                        {parseFloat(ev.qty).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
