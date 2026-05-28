import React from 'react'
import {
  Card,
  CardHeader,
  CardContent,
  Table,
  TableBody,
  TableRow,
  TableCell,
  Box,
  Chip,
  Skeleton,
  Typography,
} from '@mui/material'
import GavelIcon from '@mui/icons-material/Gavel'

/**
 * Shows tickSize, stepSize, minQty, minNotional, precisions and
 * the allowed orderTypes / timeInForce for the selected symbol.
 */
function TradingRulesPanel({ tradingRules, loading }) {
  if (loading) {
    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
          <GavelIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
          <Typography
            sx={{
              fontSize: 10,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'text.secondary',
            }}
          >
            Trading Rules
          </Typography>
        </Box>
        <Skeleton height={130} />
      </Box>
    )
  }

  if (!tradingRules) return null

  const rows = [
    ['Tick Size', tradingRules.tickSize],
    ['Step Size', tradingRules.stepSize],
    ['Min Qty', tradingRules.minQty],
    ['Min Notional', tradingRules.minNotional],
    ['Price Precision', tradingRules.pricePrecision],
    ['Qty Precision', tradingRules.quantityPrecision],
  ]

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
        <GavelIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
        <Typography
          sx={{
            fontSize: 10,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'text.secondary',
          }}
        >
          Trading Rules
        </Typography>
      </Box>
      <Table size='small'>
        <TableBody>
          {rows.map(([label, value]) => (
            <TableRow key={label}>
              <TableCell sx={{ color: 'text.secondary', border: 0, py: 0.3, fontSize: 11 }}>{label}</TableCell>
              <TableCell sx={{ fontWeight: 500, border: 0, py: 0.3, fontSize: 11 }}>{value}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.4 }}>
        {(tradingRules.orderTypes || []).map((t) => (
          <Chip key={t} label={t} size='small' variant='outlined' color='primary' sx={{ height: 18, fontSize: 10 }} />
        ))}
      </Box>
      <Box sx={{ mt: 0.4, display: 'flex', flexWrap: 'wrap', gap: 0.4 }}>
        {(tradingRules.timeInForce || []).map((t) => (
          <Chip key={t} label={t} size='small' variant='outlined' sx={{ height: 18, fontSize: 10 }} />
        ))}
      </Box>
    </Box>
  )
}

export default React.memo(TradingRulesPanel)
