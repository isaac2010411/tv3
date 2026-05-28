import React, { useState } from 'react'
import {
  Table, TableBody, TableCell, TableHead, TableRow, Paper, Chip, IconButton, Box, Typography, Tooltip,
} from '@mui/material'
import CancelIcon from '@mui/icons-material/Cancel'
import {
  useOrdersStore, selectAllOrders,
} from '../../application/stores/ordersStore'
import { cancelOrder } from '../../infrastructure/futuresApiClient'

const STATUS_COLOR = {
  NEW: 'info',
  PARTIAL: 'warning',
  FILLED: 'success',
  CANCELED: 'default',
  REJECTED: 'error',
}

const fmt = (v, d = 2) => (v == null || Number.isNaN(Number(v)) ? '—' : Number(v).toFixed(d))
const fmtTime = (ts) => (ts ? new Date(ts).toLocaleTimeString() : '—')

export default function OrdersHistoryTable() {
  const orders = useOrdersStore(selectAllOrders)
  const upsertOrder = useOrdersStore((s) => s.upsertOrder)
  const [pending, setPending] = useState({})

  const sorted = [...orders].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))

  const handleCancel = async (orderId) => {
    setPending((p) => ({ ...p, [orderId]: true }))
    try {
      const result = await cancelOrder(orderId)
      if (result?.order) upsertOrder(result.order)
    } catch (err) {
      console.warn('[OrdersHistoryTable] cancelOrder failed', err)
    } finally {
      setPending((p) => ({ ...p, [orderId]: false }))
    }
  }

  if (sorted.length === 0) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant='body2' color='text.secondary'>No orders yet.</Typography>
      </Box>
    )
  }

  return (
    <Paper variant='outlined' sx={{ overflow: 'auto', maxHeight: '100%' }}>
      <Table size='small' stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell>Time</TableCell>
            <TableCell>Symbol</TableCell>
            <TableCell>Side</TableCell>
            <TableCell>Type</TableCell>
            <TableCell align='right'>Qty</TableCell>
            <TableCell align='right'>Price</TableCell>
            <TableCell>Status</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {sorted.map((o) => {
            const isOpen = o.status === 'NEW' || o.status === 'PARTIAL'
            return (
              <TableRow key={o.orderId} hover>
                <TableCell>{fmtTime(o.createdAt)}</TableCell>
                <TableCell>{o.symbol}</TableCell>
                <TableCell>
                  <Chip size='small' label={o.side} color={o.side === 'BUY' ? 'success' : 'error'} variant='outlined' />
                </TableCell>
                <TableCell>{o.type}</TableCell>
                <TableCell align='right'>{fmt(o.quantity, 4)}</TableCell>
                <TableCell align='right'>{fmt(o.price)}</TableCell>
                <TableCell>
                  <Chip size='small' label={o.status} color={STATUS_COLOR[o.status] || 'default'} />
                </TableCell>
                <TableCell>
                  {isOpen && (
                    <Tooltip title='Cancel order'>
                      <span>
                        <IconButton
                          size='small'
                          onClick={() => handleCancel(o.orderId)}
                          disabled={!!pending[o.orderId]}
                        >
                          <CancelIcon fontSize='small' />
                        </IconButton>
                      </span>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </Paper>
  )
}
