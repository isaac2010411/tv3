import React from 'react';
import {
  Card, CardHeader, CardContent, Table, TableHead, TableBody,
  TableRow, TableCell, Chip, Typography, Box,
} from '@mui/material';

/**
 * Displays a live feed of server-detected spoofing events.
 *
 * Props:
 *   events  – array of SpoofingEvent plain objects from useLiquidityData
 *   height  – scrollable table height in px (default 200)
 */
export default function SpoofingAlertsPanel({ events = [], height = 200 }) {
  return (
    <Card variant="outlined" sx={{ mt: 1 }}>
      <CardHeader
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="subtitle2">Spoofing Alerts</Typography>
            {events.length > 0 && (
              <Chip
                label={events.length}
                size="small"
                color="warning"
              />
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
              No spoofing detected
            </Typography>
          ) : (
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ py: 0.5, fontSize: '0.65rem' }}>Time</TableCell>
                  <TableCell sx={{ py: 0.5, fontSize: '0.65rem' }}>Side</TableCell>
                  <TableCell sx={{ py: 0.5, fontSize: '0.65rem', textAlign: 'right' }}>Price</TableCell>
                  <TableCell sx={{ py: 0.5, fontSize: '0.65rem', textAlign: 'right' }}>Peak Qty</TableCell>
                  <TableCell sx={{ py: 0.5, fontSize: '0.65rem', textAlign: 'right' }}>Life (ms)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {events.slice(0, 50).map((ev, i) => {
                  const d = new Date(ev.detectedAt);
                  const timeStr = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
                  return (
                    <TableRow key={i} sx={{ background: 'rgba(251,191,36,0.05)' }}>
                      <TableCell sx={{ py: 0.25, fontSize: '0.65rem', fontFamily: 'monospace' }}>
                        {timeStr}
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
                      <TableCell sx={{ py: 0.25, fontSize: '0.65rem', textAlign: 'right', fontFamily: 'monospace', color: '#FBBF24' }}>
                        {parseFloat(ev.peakQty).toFixed(2)}
                      </TableCell>
                      <TableCell sx={{ py: 0.25, fontSize: '0.65rem', textAlign: 'right', fontFamily: 'monospace' }}>
                        {ev.lifespanMs}
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
