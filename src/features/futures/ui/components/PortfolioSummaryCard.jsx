import React, { useMemo } from 'react'
import { Card, CardContent, Typography, Stack, Box, Divider } from '@mui/material'
import ScienceIcon from '@mui/icons-material/Science'
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'
import {
  usePortfolioStore,
  selectAccountSnapshot,
  selectLiveBalance,
} from '../../application/stores/portfolioStore'
import { usePaperTradeStore } from '../../application/stores/paperTradeStore'

const fmt = (v, digits = 2) => (v == null || Number.isNaN(Number(v)) ? '-' : Number(v).toFixed(digits))
const fmtPnl = (v) => {
  if (v == null || Number.isNaN(Number(v))) return '-'
  const n = Number(v)
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}`
}
const pnlColor = (v) => (v == null ? undefined : Number(v) >= 0 ? 'success.main' : 'error.main')

const num = (v, fallback = null) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function positionQty(position) {
  return num(
    position?.positionAmt ??
      position?.quantity ??
      position?.qty ??
      position?.size ??
      position?.contracts,
    0,
  )
}

function isSameSymbol(position, symbol) {
  return !symbol || !position?.symbol || position.symbol === symbol
}

function openLivePositions(positions, symbol) {
  if (!Array.isArray(positions)) return []
  return positions.filter((position) => Math.abs(positionQty(position)) > 0 && isSameSymbol(position, symbol))
}

function sumPositionField(positions, fields) {
  return positions.reduce((acc, position) => {
    const value = fields.reduce((found, field) => found ?? num(position?.[field]), null)
    return acc + (value ?? 0)
  }, 0)
}

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

export default function PortfolioSummaryCard({ symbol, activeContext }) {
  const snapshot = usePortfolioStore(selectAccountSnapshot)
  const liveBalance = usePortfolioStore(selectLiveBalance)
  const positionsBySymbol = usePortfolioStore((s) => s.positionsBySymbol)
  const openBySymbol = usePaperTradeStore((s) => s.openBySymbol)
  const closedBySymbol = usePaperTradeStore((s) => s.closedBySymbol)

  const livePositionsFromContext = openLivePositions(activeContext?.positions, symbol)
  const livePositionsFromStore = openLivePositions(positionsBySymbol[symbol], symbol)
  const livePositionsFromSnapshot = openLivePositions(
    snapshot?.live?.positions ?? snapshot?.account?.positions ?? snapshot?.futures?.positions,
    symbol,
  )

  const livePositions = livePositionsFromContext.length > 0
    ? livePositionsFromContext
    : livePositionsFromStore.length > 0
      ? livePositionsFromStore
      : livePositionsFromSnapshot

  const liveOpenCount = livePositions.length
  const liveAvailableBalance =
    activeContext?.availableBalance ??
    snapshot?.live?.availableBalance ??
    snapshot?.account?.availableBalance ??
    snapshot?.futures?.availableBalance ??
    liveBalance
  const liveUnrealized =
    snapshot?.live?.unrealizedPnl ??
    snapshot?.account?.unrealizedPnl ??
    snapshot?.futures?.unrealizedPnl ??
    sumPositionField(livePositions, ['unrealizedProfit', 'unrealizedPnl'])
  const liveRealized =
    snapshot?.live?.realizedPnl ??
    snapshot?.account?.realizedPnl ??
    snapshot?.futures?.realizedPnl

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
            <MetricCell label='Balance' value={fmt(liveAvailableBalance)} />
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
      </CardContent>
    </Card>
  )
}
