import React from 'react';
import OrderBookImbalance from '../components/OrderBookImbalance';
import {
  useOrderBookStore,
  selectBookMetricsBySymbol,
} from '../../application/stores/orderBookStore';

function OrderBookImbalanceContainer({ symbol, loading = false }) {
  const bookMetrics = useOrderBookStore(selectBookMetricsBySymbol(symbol));

  return (
    <OrderBookImbalance
      bookMetrics={bookMetrics}
      loading={loading}
    />
  );
}

export default React.memo(OrderBookImbalanceContainer);
