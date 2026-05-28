import React from 'react';
import OrderBookImbalance from '../components/OrderBookImbalance';
import {
  useOrderBookStore,
  selectOrderBookBySymbol,
  selectLocalBookBySymbol,
} from '../../application/stores/orderBookStore';

function OrderBookImbalanceContainer({ symbol, loading = false }) {
  const localBook = useOrderBookStore(selectLocalBookBySymbol(symbol));
  const partialBook = useOrderBookStore(selectOrderBookBySymbol(symbol));
  const orderBook = localBook ?? partialBook;

  return (
    <OrderBookImbalance
      orderBook={orderBook}
      loading={loading}
    />
  );
}

export default React.memo(OrderBookImbalanceContainer);
