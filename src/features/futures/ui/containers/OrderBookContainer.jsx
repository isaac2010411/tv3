import React from 'react';
import OrderBookPanel from '../components/OrderBookPanel';
import {
  useOrderBookStore,
  selectOrderBookBySymbol,
  selectLocalBookBySymbol,
} from '../../application/stores/orderBookStore';

function OrderBookContainer({ symbol, loading = false, depth = 15 }) {
  // The backend only emits `futures:book:partial` when EMIT_BOOK_PARTIAL=true.
  // By default it only ships the locally-reconstructed book (`futures:book:local`),
  // so we use that as the primary source and fall back to the partial snapshot.
  const localBook = useOrderBookStore(selectLocalBookBySymbol(symbol));
  const partialBook = useOrderBookStore(selectOrderBookBySymbol(symbol));
  const orderBook = localBook ?? partialBook;
  return <OrderBookPanel orderBook={orderBook} loading={loading} depth={depth} />;
}

export default React.memo(OrderBookContainer);
