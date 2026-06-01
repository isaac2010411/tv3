export const FUTURES_SOCKET_EVENTS = {
  ASSET_CONTEXT: 'futures:asset:context',
  ASSET_ERROR: 'futures:asset:error',

  MARKET_TICKER: 'futures:market:ticker',
  MARKET_MARK_PRICE: 'futures:market:markPrice',
  MARKET_CANDLE: 'futures:market:candle',
  MARKET_INDICATORS: 'futures:market:indicators',
  SESSION_CANDLE_SNAPSHOT: 'futures:session:candle:snapshot',

  BOOK_PARTIAL: 'futures:book:partial',
  BOOK_LOCAL: 'futures:book:local',
  BOOK_METRICS: 'futures:book:metrics',
  BOOK_HEALTH: 'futures:book:health',

  TRADE_AGG: 'futures:trade:agg',

  ORDERFLOW_CVD: 'futures:orderflow:cvd',
  ORDERFLOW_FOOTPRINT: 'futures:orderflow:footprint',
  ORDERFLOW_FOOTPRINT_INIT: 'futures:orderflow:footprint:init',

  LIQUIDITY_SHIFT: 'futures:liquidity:shift',
  SPOOFING_CANDIDATE: 'futures:spoofing:candidate',

  SIGNAL_UPDATE: 'futures:signal:update',
  DECISION_TAPE: 'futures:decision:tape',

  PAPER_TRADE_OPENED: 'futures:paperTrade:opened',
  PAPER_TRADE_UPDATED: 'futures:paperTrade:updated',
  PAPER_TRADE_CLOSED: 'futures:paperTrade:closed',

  RISK_DECISION: 'futures:risk:decision',
  ORDER_LIFECYCLE: 'futures:order:lifecycle',
  PORTFOLIO_SNAPSHOT: 'futures:portfolio:snapshot',
}

export const FUTURES_SOCKET_COMMANDS = {
  SUBSCRIBE_ASSET: 'futures:asset:subscribe',
  UNSUBSCRIBE_ASSET: 'futures:asset:unsubscribe',

  SIGNAL_POSITION_ACCEPT: 'futures:signal:position:accept',
  SIGNAL_POSITION_CLOSE: 'futures:signal:position:close',
}
