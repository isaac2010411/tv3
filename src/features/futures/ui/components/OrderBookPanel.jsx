import React, { useMemo, useState } from 'react';
import {
  Card, CardHeader, CardContent,
  Table, TableHead, TableRow, TableCell, TableBody,
  Typography, Skeleton, Box, ToggleButtonGroup, ToggleButton, Tooltip,
} from '@mui/material';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import { sanitizeOrderBook, safeFormat } from '../../utils/marketDataGuards';

const DEPTH_OPTIONS = [10, 20, 50];

function OBRow({ level, maxTotal, isBid, isBest, priceDec = 2 }) {
  const pct      = maxTotal > 0 ? Math.min((level.total / maxTotal) * 100, 100) : 0;
  const color    = isBid ? 'success.main' : 'error.main';
  const barColor = isBid ? '#22C55E' : '#EF4444';
  const notional = (level.price * level.quantity);

  return (
    <Tooltip
      title={`Notional: $${notional.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
      placement="left"
      arrow
    >
      <TableRow
        sx={{
          position: 'relative',
          outline: isBest ? `1px solid ${barColor}` : 'none',
          outlineOffset: '-1px',
        }}
      >
        <TableCell sx={{ border: 0, py: 0.2, px: 1, width: '40%', position: 'relative' }}>
          {/* depth bar */}
          <Box
            sx={{
              position: 'absolute', top: 0, bottom: 0, right: 0,
              width: `${pct}%`, bgcolor: barColor, opacity: 0.14,
            }}
          />
          <Typography component="span" sx={{ fontSize: 12, color, position: 'relative', fontWeight: isBest ? 700 : 400 }}>
            {level.price.toFixed(priceDec)}
          </Typography>
        </TableCell>
        <TableCell align="right" sx={{ border: 0, py: 0.2, px: 1, fontSize: 12 }}>
          {level.quantity.toFixed(4)}
        </TableCell>
        <TableCell align="right" sx={{ border: 0, py: 0.2, px: 1, fontSize: 12, color: 'text.secondary' }}>
          {level.total.toFixed(2)}
        </TableCell>
      </TableRow>
    </Tooltip>
  );
}

/**
 * Order book panel with:
 *   – Depth selector (10 / 20 / 50)
 *   – Best bid / ask highlight
 *   – Spread shown in the centre row (absolute + %)
 *   – Notional tooltip per level
 *   – Never renders if orderBook is invalid
 *
 * Props:
 *   orderBook – processed OrderBook from processOrderBook()
 *   loading   – show skeleton
 *   depth     – controlled depth (default 15); overridden by internal selector
 */
function OrderBookPanel({ orderBook, loading, depth: depthProp = 15 }) {
  const [depth, setDepth] = useState(depthProp);

  const book = useMemo(() => sanitizeOrderBook(orderBook), [orderBook]);

  // asks displayed top→bottom worst→best (best ask is closest to the spread row)
  const asks = useMemo(
    () => (book?.asks ?? []).slice(0, depth).reverse(),
    [book, depth]
  );
  const bids = useMemo(
    () => (book?.bids ?? []).slice(0, depth),
    [book, depth]
  );

  const maxAskTotal = asks[0]?.total || 1;
  const maxBidTotal = bids[bids.length - 1]?.total || 1;

  const priceDec = useMemo(() => {
    const step = book?.spread > 0 ? book.spread : (book?.bestBid ? book.bestBid * 0.0001 : 0.01);
    return step > 0 ? Math.max(0, Math.ceil(-Math.log10(step))) : 2;
  }, [book]);

  const spreadLabel = book?.spread != null
    ? `${safeFormat(book.spread, priceDec)} (${safeFormat(book.spreadPct, 3)}%)`
    : '—';

  if (loading) {
    return (
      <Card variant="outlined">
        <CardHeader title="Order Book" titleTypographyProps={{ variant: 'subtitle2' }} />
        <CardContent><Skeleton height={400} /></CardContent>
      </Card>
    );
  }

  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardHeader
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <MenuBookIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
            <span>Order Book</span>
          </Box>
        }
        titleTypographyProps={{ variant: 'subtitle2' }}
        sx={{ pb: 0 }}
        action={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 0.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
              Spr {spreadLabel}
            </Typography>
            <ToggleButtonGroup
              exclusive size="small"
              value={depth}
              onChange={(_, v) => v && setDepth(v)}
            >
              {DEPTH_OPTIONS.map((d) => (
                <ToggleButton key={d} value={d} sx={{ fontSize: 9, py: 0.1, px: 0.6, lineHeight: 1.4 }}>
                  {d}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
        }
      />
      <CardContent sx={{ pt: 0, px: 0 }}>
        {!book ? (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', py: 2 }}>
            Awaiting valid order book…
          </Typography>
        ) : (
          <Table size="small" sx={{ tableLayout: 'fixed' }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ border: 0, py: 0.5, fontSize: 11, color: 'text.secondary' }}>Price</TableCell>
                <TableCell align="right" sx={{ border: 0, py: 0.5, fontSize: 11, color: 'text.secondary' }}>Qty</TableCell>
                <TableCell align="right" sx={{ border: 0, py: 0.5, fontSize: 11, color: 'text.secondary' }}>Total</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {asks.map((lvl, i) => (
                <OBRow
                  key={`ask-${i}`} level={lvl} maxTotal={maxAskTotal} isBid={false}
                  isBest={i === asks.length - 1} priceDec={priceDec}
                />
              ))}

              <TableRow>
                <TableCell
                  colSpan={3}
                  sx={{ border: 0, py: 0.5, bgcolor: 'background.default', textAlign: 'center' }}
                >
                  <Typography variant="caption" color="text.secondary">
                    — Spread: {spreadLabel} —
                  </Typography>
                </TableCell>
              </TableRow>

              {bids.map((lvl, i) => (
                <OBRow
                  key={`bid-${i}`} level={lvl} maxTotal={maxBidTotal} isBid={true}
                  isBest={i === 0} priceDec={priceDec}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export default React.memo(OrderBookPanel);
