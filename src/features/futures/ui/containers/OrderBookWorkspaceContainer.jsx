import React, { useMemo } from 'react';
import { Box, Divider } from '@mui/material';
import { useOrderBookStore, selectOrderBookBySymbol } from '../../application/stores/orderBookStore';
import OrderBookImbalance from '../components/OrderBookImbalance';
import OrderBookPanel from '../components/OrderBookPanel';
import LiquidityWallsPanel from '../components/LiquidityWallsPanel';

export default function OrderBookWorkspaceContainer({ symbol, loading = false }) {
  const orderBook = useOrderBookStore(selectOrderBookBySymbol(symbol));

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden auto', borderRight: '1px solid', borderColor: 'divider' }}>
      <Box sx={{ p: 1.5, pb: 1 }}>
        <OrderBookImbalance orderBook={orderBook} loading={loading} />
      </Box>
      <Divider />
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <OrderBookPanel orderBook={orderBook} loading={loading} depth={15} />
      </Box>
      <Divider />
      <Box sx={{ p: 1, pt: 0 }}>
        <LiquidityWallsPanel orderBook={orderBook} loading={loading} />
      </Box>
    </Box>
  );
}

