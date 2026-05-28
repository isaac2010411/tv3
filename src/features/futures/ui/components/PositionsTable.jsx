import React from 'react'
import {
  Table, TableBody, TableCell, TableHead, TableRow, Paper, Typography, Chip, Box,
} from '@mui/material'
import { usePortfolioStore, selectAccountSnapshot } from '../../application/stores/portfolioStore'

const fmt = (v, d = 2) => (v == null || Number.isNaN(Number(v)) ? '—' : Number(v).toFixed(d))

export default function PositionsTable() {
  const snapshot = usePortfolioStore(selectAccountSnapshot)
  const positions = snapshot?.positions || []

  if (positions.length === 0) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant='body2' color='text.secondary'>No open positions.</Typography>
      </Box>
    )
  }

  return (
    <Paper variant='outlined' sx={{ overflow: 'auto', maxHeight: '100%' }}>
      <Table size='small' stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell>Symbol</TableCell>
            <TableCell>Side</TableCell>
            <TableCell align='right'>Qty</TableCell>
            <TableCell align='right'>Entry</TableCell>
            <TableCell align='right'>Notional</TableCell>
            <TableCell align='right'>Realized PnL</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {positions.map((p) => {
            const notional = (p.quantity || 0) * (p.entryPrice || 0)
            return (
              <TableRow key={p.positionId || `${p.symbol}-${p.direction}`} hover>
                <TableCell>{p.symbol}</TableCell>
                <TableCell>
                  <Chip
                    size='small'
                    label={p.direction}
                    color={p.direction === 'LONG' ? 'success' : 'error'}
                    variant='outlined'
                  />
                </TableCell>
                <TableCell align='right'>{fmt(p.quantity, 4)}</TableCell>
                <TableCell align='right'>{fmt(p.entryPrice)}</TableCell>
                <TableCell align='right'>{fmt(notional)}</TableCell>
                <TableCell align='right' sx={{ color: (p.realizedPnl || 0) >= 0 ? 'success.main' : 'error.main' }}>
                  {fmt(p.realizedPnl)}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </Paper>
  )
}
