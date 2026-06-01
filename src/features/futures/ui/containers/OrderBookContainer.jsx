import React from 'react';
import OrderBookPanel from '../components/OrderBookPanel';
import {
  useOrderBookStore,
  selectOrderBookBySymbol,
  selectLocalBookBySymbol,
} from '../../application/stores/orderBookStore';

function OrderBookContainer({ symbol, loading = false, depth = 15 }) {
  const localBook = useOrderBookStore(selectLocalBookBySymbol(symbol));
  const partialBook = useOrderBookStore(selectOrderBookBySymbol(symbol));
  const orderBook = localBook ?? partialBook;
  return <OrderBookPanel orderBook={orderBook} loading={loading} depth={depth} />;
}

export default React.memo(OrderBookContainer);
