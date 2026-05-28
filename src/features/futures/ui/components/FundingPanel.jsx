import React from 'react'
import { CardContent, Typography, Box, Skeleton } from '@mui/material'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import PaidOutlinedIcon from '@mui/icons-material/PaidOutlined'
import { formatPercent, formatDateTime } from '../../utils/formatters'

/**
 * Compact panel showing current funding rate and next funding time.
 * Rendered without Card wrapper — used inside the right sidebar section.
 */
function FundingPanel({ context, realtimeMarkPrice, loading }) {
  const fundingRate = realtimeMarkPrice?.fundingRate ?? context?.fundingRate
  const nextFundingTime = realtimeMarkPrice?.nextFundingTime ?? context?.nextFundingTime
  const interestRate = context?.interestRate

  const sectionLabel = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
      <PaidOutlinedIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
      <Typography
        sx={{
          fontSize: 10,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'text.secondary',
        }}
      >
        Funding
      </Typography>
    </Box>
  )

  if (loading) {
    return (
      <Box>
        {sectionLabel}
        <Skeleton height={48} />
      </Box>
    )
  }

  return (
    <Box>
      {sectionLabel}
      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        <Box>
          <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Rate</Typography>
          <Typography
            sx={{ fontSize: 15, fontWeight: 700, color: parseFloat(fundingRate) >= 0 ? 'success.main' : 'error.main' }}
          >
            {formatPercent(fundingRate, 4)}
          </Typography>
        </Box>
        <Box>
          <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Next</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, mt: 0.25 }}>
            <AccessTimeIcon sx={{ fontSize: 11, color: 'text.secondary' }} />
            <Typography sx={{ fontSize: 12 }}>{formatDateTime(nextFundingTime)}</Typography>
          </Box>
        </Box>
        {interestRate != null && (
          <Box>
            <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Interest</Typography>
            <Typography sx={{ fontSize: 12 }}>{formatPercent(interestRate, 4)}</Typography>
          </Box>
        )}
      </Box>
    </Box>
  )
}

export default React.memo(FundingPanel)
