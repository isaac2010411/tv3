import React from 'react'
import {
  Table, TableBody, TableCell, TableHead, TableRow, Paper, Typography, Chip, Box,
} from '@mui/material'
import {
  usePortfolioStore,
  selectAccountSnapshot,
  selectPositionsBySymbol,
} from '../../application/stores/portfolioStore'

const fmt = (v, d = 2) => (v == null || Number.isNaN(Number(v)) ? '-' : Number(v).toFixed(d))

const num = (v, fallback = 0) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function normalizePositionForTable(position) {
  const rawQty = num(
    position.positionAmt ??
      position.quantity ??
      position.qty ??
      position.size ??
      position.contracts,
  )
  const entryPrice = num(position.entryPrice ?? position.entry)
  const markPrice = num(position.markPrice ?? position.currentPrice ?? position.price, null)
  const direction = position.direction ?? position.side ?? (rawQty >= 0 ? 'LONG' : 'SHORT')
  const unrealizedPnl = num(position.unrealizedProfit ?? position.unrealizedPnl, null)
  const realizedPnl = num(position.realizedPnl, null)
  const notional = num(position.notional, Math.abs(rawQty) * (markPrice ?? entryPrice))

  return {
    id: position.positionId ?? position.id ?? `${position.symbol}-${direction}-${entryPrice}`,
    symbol: position.symbol,
    direction,
    quantity: Math.abs(rawQty),
    entryPrice,
    markPrice,
    notional,
    pnl: unrealizedPnl ?? realizedPnl,
  }
}

export default function PositionsTable({ symbol }) {
  const snapshot = usePortfolioStore(selectAccountSnapshot)
  const symbolPositions = usePortfolioStore(selectPositionsBySymbol(symbol))
  const snapshotPositions =
    snapshot?.live?.positions ??
    snapshot?.account?.positions ??
    snapshot?.futures?.positions ??
    []
  const basePositions = symbolPositions.length > 0
    ? symbolPositions
    : snapshotPositions.filter((position) => !symbol || position?.symbol === symbol)
  const positions = basePositions.filter((position) => !symbol || position?.symbol === symbol)

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
            <TableCell align='right'>Mark</TableCell>
            <TableCell align='right'>Notional</TableCell>
            <TableCell align='right'>PnL</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {positions.map((p) => {
            const pos = normalizePositionForTable(p)
            return (
              <TableRow key={pos.id} hover>
                <TableCell>{pos.symbol}</TableCell>
                <TableCell>
                  <Chip
                    size='small'
                    label={pos.direction}
                    color={pos.direction === 'LONG' ? 'success' : 'error'}
                    variant='outlined'
                  />
                </TableCell>
                <TableCell align='right'>{fmt(pos.quantity, 4)}</TableCell>
                <TableCell align='right'>{fmt(pos.entryPrice)}</TableCell>
                <TableCell align='right'>{fmt(pos.markPrice)}</TableCell>
                <TableCell align='right'>{fmt(pos.notional)}</TableCell>
                <TableCell align='right' sx={{ color: (pos.pnl || 0) >= 0 ? 'success.main' : 'error.main' }}>
                  {fmt(pos.pnl)}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </Paper>
  )
}
