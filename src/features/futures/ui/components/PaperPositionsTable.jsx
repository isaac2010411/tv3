import React, { useEffect, useMemo, useState } from 'react'
import {
  Box, Table, TableBody, TableCell, TableHead, TableRow, Paper, Typography,
  Chip, ToggleButtonGroup, ToggleButton, Stack,
} from '@mui/material'
import {
  usePaperTradeStore,
  selectOpenPaperPositionsBySymbol,
  selectClosedPaperPositionsBySymbol,
} from '../../application/stores/paperTradeStore'
import { fetchPaperPositions } from '../../infrastructure/futuresApiClient'

const fmt = (v, d = 2) => (v == null || Number.isNaN(Number(v)) ? '—' : Number(v).toFixed(d))
const fmtPnl = (v) => {
  if (v == null || Number.isNaN(Number(v))) return '—'
  const n = Number(v)
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}`
}

function StatPill({ label, value, tone = 'default' }) {
  const color = tone === 'positive' ? 'success.main' : tone === 'negative' ? 'error.main' : 'text.secondary'
  return (
    <Box sx={{ px: 1, py: 0.4, borderRadius: 1, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
      <Typography sx={{ fontSize: 9, color: 'text.secondary', lineHeight: 1, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</Typography>
      <Typography sx={{ fontSize: 12, color, fontWeight: 700, lineHeight: 1.2 }}>{value}</Typography>
    </Box>
  )
}

/**
 * Bottom-strip table consolidating paper-trading positions (open + closed)
 * for the current symbol. Replaces the duplicate panel that lived in the
 * right execution sidebar.
 */
export default function PaperPositionsTable({ symbol }) {
  const openPositions = usePaperTradeStore(selectOpenPaperPositionsBySymbol(symbol))
  const closedPositions = usePaperTradeStore(selectClosedPaperPositionsBySymbol(symbol))
  const hydrateSymbol = usePaperTradeStore((s) => s.hydrateSymbol)

  const [view, setView] = useState('open')
  const [hydrating, setHydrating] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    if (!symbol) return () => { active = false }
    setHydrating(true)
    setError(null)
    fetchPaperPositions({ symbol, limit: 200, page: 1 })
      .then((res) => { if (active) hydrateSymbol(symbol, res?.items ?? []) })
      .catch((e) => { if (active) setError(e.message) })
      .finally(() => { if (active) setHydrating(false) })
    return () => { active = false }
  }, [symbol, hydrateSymbol])

  const metrics = useMemo(() => {
    const totalUnrealized = openPositions.reduce((acc, p) => acc + (Number(p.unrealizedPnl) || 0), 0)
    const totalRealized = closedPositions.reduce((acc, p) => acc + (Number(p.realizedPnl) || 0), 0)
    const wins = closedPositions.filter((p) => Number(p.realizedPnl) > 0).length
    const winRate = closedPositions.length > 0 ? (wins / closedPositions.length) * 100 : 0
    return { totalUnrealized, totalRealized, winRate }
  }, [openPositions, closedPositions])

  const rows = view === 'open' ? openPositions : closedPositions

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Stack
        direction='row'
        alignItems='center'
        spacing={1}
        sx={{ px: 1, py: 0.5, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}
      >
        <ToggleButtonGroup
          exclusive
          size='small'
          value={view}
          onChange={(_, v) => v && setView(v)}
        >
          <ToggleButton value='open' sx={{ fontSize: 10, py: 0.1, px: 1 }}>
            Open ({openPositions.length})
          </ToggleButton>
          <ToggleButton value='closed' sx={{ fontSize: 10, py: 0.1, px: 1 }}>
            History ({closedPositions.length})
          </ToggleButton>
        </ToggleButtonGroup>
        <Box sx={{ flex: 1 }} />
        <StatPill
          label='Unrlz'
          value={fmtPnl(metrics.totalUnrealized)}
          tone={metrics.totalUnrealized >= 0 ? 'positive' : 'negative'}
        />
        <StatPill
          label='Rlz'
          value={fmtPnl(metrics.totalRealized)}
          tone={metrics.totalRealized >= 0 ? 'positive' : 'negative'}
        />
        <StatPill label='Win%' value={`${metrics.winRate.toFixed(0)}%`} />
        <Chip
          size='small'
          variant='outlined'
          color={hydrating ? 'warning' : 'success'}
          label={hydrating ? 'sync' : 'mongo'}
          sx={{ height: 18, fontSize: 9 }}
        />
      </Stack>

      {error && (
        <Typography sx={{ fontSize: 10, color: 'warning.main', px: 1, py: 0.5 }}>
          Persistencia no disponible: {error}
        </Typography>
      )}

      {rows.length === 0 ? (
        <Box sx={{ p: 2, flex: 1 }}>
          <Typography variant='body2' color='text.secondary'>
            {view === 'open' ? 'No paper positions open for this symbol.' : 'No closed paper trades for this symbol.'}
          </Typography>
        </Box>
      ) : (
        <Paper variant='outlined' square sx={{ flex: 1, overflow: 'auto', borderTop: 0, borderLeft: 0, borderRight: 0 }}>
          <Table size='small' stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Side</TableCell>
                <TableCell align='right'>Qty</TableCell>
                <TableCell align='right'>Entry</TableCell>
                <TableCell align='right'>{view === 'open' ? 'Mark' : 'Exit'}</TableCell>
                <TableCell align='right'>{view === 'open' ? 'uPnL' : 'rPnL'}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((p) => {
                const pnlValue = view === 'open' ? p.unrealizedPnl : p.realizedPnl
                const pnlColor = (Number(pnlValue) || 0) >= 0 ? 'success.main' : 'error.main'
                return (
                  <TableRow key={p.id} hover>
                    <TableCell>
                      <Chip
                        size='small'
                        label={p.direction}
                        color={p.direction === 'LONG' ? 'success' : 'error'}
                        variant='outlined'
                        sx={{ height: 18, fontSize: 9 }}
                      />
                    </TableCell>
                    <TableCell align='right'>{fmt(p.quantity, 4)}</TableCell>
                    <TableCell align='right'>{fmt(p.entryPrice)}</TableCell>
                    <TableCell align='right'>{fmt(view === 'open' ? p.currentPrice : p.exitPrice)}</TableCell>
                    <TableCell align='right' sx={{ color: pnlColor, fontWeight: 600 }}>
                      {fmtPnl(pnlValue)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
  )
}
