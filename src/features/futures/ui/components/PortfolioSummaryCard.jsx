import React, { useMemo } from 'react'
import { Card, CardContent, Typography, Stack, Box, Divider, Chip } from '@mui/material'
import ScienceIcon from '@mui/icons-material/Science'
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'
import {
  usePortfolioStore,
  selectAccountSnapshot,
  selectExposure,
  selectPerformance,
} from '../../application/stores/portfolioStore'
import { usePaperTradeStore } from '../../application/stores/paperTradeStore'

const fmt = (v, digits = 2) => (v == null || Number.isNaN(Number(v)) ? '—' : Number(v).toFixed(digits))
const fmtPnl = (v) => {
  if (v == null || Number.isNaN(Number(v))) return '—'
  const n = Number(v)
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}`
}
const pnlColor = (v) => (v == null ? undefined : Number(v) >= 0 ? 'success.main' : 'error.main')

function MetricCell({ label, value, color }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ fontSize: 9, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 12, fontWeight: 700, color, lineHeight: 1.3 }}>{value}</Typography>
    </Box>
  )
}

function Section({ icon, title, children }) {
  return (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Stack direction='row' alignItems='center' spacing={0.5} sx={{ mb: 0.5 }}>
        {icon}
        <Typography variant='caption' sx={{ fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {title}
        </Typography>
      </Stack>
      <Stack direction='row' spacing={1.5}>
        {children}
      </Stack>
    </Box>
  )
}

export default function PortfolioSummaryCard() {
  const snapshot = usePortfolioStore(selectAccountSnapshot)
  const exposure = usePortfolioStore(selectExposure)
  const performance = usePortfolioStore(selectPerformance)
  const openBySymbol = usePaperTradeStore((s) => s.openBySymbol)
  const closedBySymbol = usePaperTradeStore((s) => s.closedBySymbol)

  const liveOpenCount = snapshot?.positions?.length ?? 0
  const liveNotional = snapshot?.totalNotional ?? exposure?.totalNotional
  const liveRealized = performance?.totalRealizedPnl ?? snapshot?.realizedPnl
  const liveUnrealized = snapshot?.unrealizedPnl

  const paperStats = useMemo(() => {
    let open = 0
    let unrealized = 0
    let realized = 0
    let wins = 0
    let total = 0
    Object.values(openBySymbol).forEach((arr) => {
      open += arr.length
      arr.forEach((p) => { unrealized += Number(p.unrealizedPnl) || 0 })
    })
    Object.values(closedBySymbol).forEach((arr) => {
      arr.forEach((p) => {
        const r = Number(p.realizedPnl) || 0
        realized += r
        if (r > 0) wins += 1
        total += 1
      })
    })
    return {
      open,
      unrealized,
      realized,
      winRate: total > 0 ? (wins / total) * 100 : 0,
    }
  }, [openBySymbol, closedBySymbol])

  // Backend-tracked paper account: starting cap (default $10k) + cumulative
  // realized PnL replayed from Mongo on boot. Falls back to the live in-store
  // realized PnL if the snapshot hasn't arrived yet (e.g. first paint).
  const backendPaperSummary = snapshot?.paperSummary ?? null
  const paperAccount = snapshot?.paper ?? null
  const paperStartingEquity = backendPaperSummary?.startingEquity ?? paperAccount?.startingEquity ?? 10_000
  const paperRealizedToDate = backendPaperSummary?.realizedPnl ?? paperAccount?.realizedToDate ?? paperStats.realized
  const paperEquity = backendPaperSummary?.equity ?? (paperStartingEquity + paperRealizedToDate + paperStats.unrealized)
  const paperOpenCount = backendPaperSummary?.openCount ?? paperStats.open
  const paperUnrealized = backendPaperSummary?.unrealizedPnl ?? paperStats.unrealized
  const paperWinRate = backendPaperSummary?.winRate ?? paperStats.winRate
  const paperEquityColor = paperEquity >= paperStartingEquity ? 'success.main' : 'error.main'

  return (
    <Card variant='outlined' sx={{ minWidth: 380 }}>
      <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
        <Stack direction='row' spacing={1} alignItems='stretch' divider={<Divider orientation='vertical' flexItem />}>
          <Section
            icon={<AccountBalanceWalletIcon sx={{ fontSize: 13, color: 'success.main' }} />}
            title='Live'
          >
            <MetricCell label='Pos' value={liveOpenCount} />
            <MetricCell label='Notional' value={fmt(liveNotional)} />
            <MetricCell label='uPnL' value={fmtPnl(liveUnrealized)} color={pnlColor(liveUnrealized)} />
            <MetricCell label='rPnL' value={fmtPnl(liveRealized)} color={pnlColor(liveRealized)} />
          </Section>
          <Section
            icon={<ScienceIcon sx={{ fontSize: 13, color: 'info.main' }} />}
            title='Paper'
          >
            <MetricCell label='Equity' value={fmt(paperEquity)} color={paperEquityColor} />
            <MetricCell label='Pos' value={paperOpenCount} />
            <MetricCell label='uPnL' value={fmtPnl(paperUnrealized)} color={pnlColor(paperUnrealized)} />
            <MetricCell label='rPnL' value={fmtPnl(paperRealizedToDate)} color={pnlColor(paperRealizedToDate)} />
            <MetricCell label='Win%' value={`${Number(paperWinRate).toFixed(0)}%`} />
          </Section>
        </Stack>
        {exposure?.exposureBySymbol && Object.keys(exposure.exposureBySymbol).length > 0 && (
          <Box sx={{ mt: 0.75, pt: 0.5, borderTop: '1px dashed', borderColor: 'divider' }}>
            <Stack direction='row' spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
              {Object.entries(exposure.exposureBySymbol).map(([sym, val]) => (
                <Chip
                  key={sym}
                  size='small'
                  variant='outlined'
                  label={`${sym} ${fmt(val)}`}
                  sx={{ height: 18, fontSize: 9 }}
                />
              ))}
            </Stack>
          </Box>
        )}
      </CardContent>
    </Card>
  )
}
