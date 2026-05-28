import React from 'react';
import {
  Card, CardHeader, CardContent,
  Table, TableHead, TableRow, TableCell, TableBody,
  Chip, Skeleton, Typography, Box,
} from '@mui/material';
import ArrowUpwardIcon   from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { formatPrice, formatQty, formatDateTime } from '../../utils/formatters';

/**
 * Table of open limit/stop orders for the selected symbol (paper/demo data).
 * compact=true hides the Card wrapper (used inside bottom tabs panel).
 */
export default function OpenOrdersPanel({ openOrders = [], loading, compact = false }) {
  if (loading) {
    return (
      <Card variant="outlined">
        <CardContent><Skeleton height={100} /></CardContent>
      </Card>
    );
  }

  const inner = (
    <CardContent sx={{ pt: 0, px: 0 }}>
      {openOrders.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 1 }}>
          No open orders
        </Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              {['Time', 'Side', 'Type', 'Price', 'Qty', 'Filled', 'Status'].map((h) => (
                <TableCell key={h} sx={{ border: 0, py: 0.5, fontSize: 10, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {h}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {openOrders.map((order) => (
              <TableRow key={order.orderId} hover sx={{ '&:hover': { bgcolor: '#0F1923' } }}>
                <TableCell sx={{ border: 0, py: 0.3, fontSize: 10, color: 'text.secondary' }}>
                  {formatDateTime(order.time)}
                </TableCell>
                <TableCell sx={{ border: 0, py: 0.3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                    {order.side === 'BUY'
                      ? <ArrowUpwardIcon   sx={{ fontSize: 10, color: 'success.main' }} />
                      : <ArrowDownwardIcon sx={{ fontSize: 10, color: 'error.main'   }} />}
                    <Typography sx={{
                      fontSize: 11, fontWeight: 600,
                      color: order.side === 'BUY' ? 'success.main' : 'error.main',
                    }}>
                      {order.side}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell sx={{ border: 0, py: 0.3, fontSize: 11 }}>{order.type}</TableCell>
                <TableCell sx={{ border: 0, py: 0.3, fontSize: 11 }}>
                  {formatPrice(order.price, 2)}
                </TableCell>
                <TableCell sx={{ border: 0, py: 0.3, fontSize: 11 }}>
                  {formatQty(order.origQty, 3)}
                </TableCell>
                <TableCell sx={{ border: 0, py: 0.3, fontSize: 11 }}>
                  {formatQty(order.executedQty, 3)}
                </TableCell>
                <TableCell sx={{ border: 0, py: 0.3 }}>
                  <Chip label={order.status} size="small" variant="outlined" sx={{ height: 18, fontSize: 10 }} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </CardContent>
  );

  if (compact) return inner;

  return (
    <Card variant="outlined">
      <CardHeader
        title={`Open Orders (${openOrders.length})`}
        titleTypographyProps={{ variant: 'subtitle2' }}
        sx={{ pb: 0 }}
      />
      {inner}
    </Card>
  );
}
