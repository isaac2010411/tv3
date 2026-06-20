import { useEffect, useMemo, useRef } from 'react'
import {
  onEvent,
  offEvent,
  onConnectionChange,
  getConnectionStatus,
  getSocketDebugSnapshot,
} from '../infrastructure/futuresSocketClient'
import { FUTURES_SOCKET_EVENTS } from '../infrastructure/futuresSocketEvents'
import { normalizeServerContext } from '../domain/futuresAssetContext.model'
import { fetchCandles, fetchPaperPositions } from '../infrastructure/futuresApiClient'
import { useRealtimeMetricsStore } from '../observability/realtimeMetricsStore'
import { useSubscriptionPlanStore } from './subscriptions/subscriptionPlanStore'

import { useFuturesConnectionStore } from './stores/futuresConnectionStore'
import { useMarketDataStore } from './stores/marketDataStore'
import { useOrderBookStore } from './stores/orderBookStore'
import { useOrderFlowStore } from './stores/orderFlowStore'
import { useSignalStore } from './stores/signalStore'
import { usePortfolioStore } from './stores/portfolioStore'
import { usePaperTradeStore } from './stores/paperTradeStore'

function normalizeTs(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  return n < 1_000_000_000_000 ? n * 1000 : n
}

function extractSymbol(data) {
  return (
    data?.symbol ?? data?.s ?? data?.candle?.symbol ?? data?.candle?.s ?? data?.kline?.symbol ?? data?.kline?.s ?? data?.footprint?.symbol ?? data?.footprint?.s ?? null
  )
}

function extractEventTime(data) {
  if (!data) return null
  return normalizeTs(
    data?._meta?.exchangeEventTime ??
      data?._meta?.serverEventTime ??
      data?.eventTime ??
      data?.E ??
      data?.timestamp ??
      data?.ts ??
      data?.time ??
      data?.T,
  )
}

function extractInterval(data) {
  return (
    data?.interval ??
    data?.i ??
    data?.candle?.interval ??
    data?.candle?.i ??
    data?.k?.interval ??
    data?.k?.i ??
    data?.kline?.interval ??
    data?.kline?.i ??
    data?.footprint?.interval ??
    data?.footprint?.i ??
    null
  )
}

function extractCandlePayload(data) {
  return data?.candle ?? data?.kline ?? data?.k ?? data
}

function extractCandleOpenTime(candle) {
  return normalizeTs(candle?.openTime ?? candle?.t ?? candle?.open_time)
}

function intervalToMs(interval) {
  const m = /^(\d+)([smhdw])$/.exec(interval ?? '')
  if (!m) return 0
  const n = Number.parseInt(m[1], 10)
  const units = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 }
  return n * (units[m[2]] ?? 0)
}

function normalizeBookLevel(level) {
  const price = Number(Array.isArray(level) ? level[0] : level?.price)
  const quantity = Number(Array.isArray(level) ? level[1] : level?.quantity ?? level?.qty)
  if (!Number.isFinite(price) || !Number.isFinite(quantity)) return null
  return { price, quantity }
}

function trimLevels(levels, max = MAX_BOOK_LEVELS_IN_MEMORY) {
  return Array.isArray(levels) ? levels.slice(0, max) : []
}

function trimFootprintLevels(footprint) {
  if (!footprint || !Array.isArray(footprint.levels)) return footprint
  if (footprint.levels.length <= MAX_FOOTPRINT_LEVELS_IN_MEMORY) return footprint
  const pocIndex = footprint.levels.findIndex((level) => level?.isPoc)
  if (pocIndex < 0) {
    return { ...footprint, levels: footprint.levels.slice(-MAX_FOOTPRINT_LEVELS_IN_MEMORY) }
  }
  const half = Math.floor(MAX_FOOTPRINT_LEVELS_IN_MEMORY / 2)
  const start = Math.max(0, pocIndex - half)
  return { ...footprint, levels: footprint.levels.slice(start, start + MAX_FOOTPRINT_LEVELS_IN_MEMORY) }
}

function normalizeBackendBook(data) {
  const metrics = data?.bookMetrics ?? null
  const bestBid = Number(metrics?.bestBid ?? data?.bestBid)
  const bestAsk = Number(metrics?.bestAsk ?? data?.bestAsk)
  const spread = Number(metrics?.spread ?? data?.spread)
  const spreadPct = Number(metrics?.spreadPct ?? data?.spreadPct)
  const midPrice = Number(metrics?.midPrice ?? data?.midPrice)
  const bids = trimLevels(data?.bids).map(normalizeBookLevel).filter(Boolean)
  const asks = trimLevels(data?.asks).map(normalizeBookLevel).filter(Boolean)
  const isValidTopOfBook = Boolean(
    Number.isFinite(bestBid) &&
    Number.isFinite(bestAsk) &&
    bestAsk > bestBid
  )

  return {
    ...data,
    bids,
    asks,
    bestBid: Number.isFinite(bestBid) ? bestBid : null,
    bestAsk: Number.isFinite(bestAsk) ? bestAsk : null,
    spread: Number.isFinite(spread) ? spread : null,
    spreadPct: Number.isFinite(spreadPct) ? spreadPct : null,
    midPrice: Number.isFinite(midPrice) ? midPrice : null,
    isValidTopOfBook,
    bookMetrics: metrics,
  }
}

function topOfBookFromMetrics(metrics) {
  if (!metrics) return null
  const bestBid = Number(metrics.bestBid)
  const bestAsk = Number(metrics.bestAsk)
  if (!Number.isFinite(bestBid) || !Number.isFinite(bestAsk) || bestAsk <= bestBid) return null
  return {
    bestBid,
    bestAsk,
    spread: metrics.spread,
    spreadPct: metrics.spreadPct,
    midPrice: metrics.midPrice,
    isValidTopOfBook: true,
  }
}

const METRIC_FLUSH_MS = 120
const MAX_PENDING_TRADES = 40
const ORDERFLOW_FLUSH_MS = 250
const MARKET_FRAME_FLUSH_MS = 250
const MAX_EVENT_AGE_MS = 5_000
const MAX_TRADE_BATCH_AGE_MS = 5_000
const CANDLE_RECOVERY_CHECK_MS = 5_000
const CANDLE_RECOVERY_COOLDOWN_MS = 30_000
const MIN_CANDLE_STALE_RECOVERY_MS = 90_000
const MAX_BOOK_LEVELS_IN_MEMORY = 60
const MAX_CANDLES_IN_MEMORY = 180
const MAX_TRADES_IN_MEMORY = 120
const MAX_CVD_POINTS_IN_MEMORY = 240
const MAX_FOOTPRINTS_IN_MEMORY = 80
const MAX_FOOTPRINT_LEVELS_IN_MEMORY = 80
const DEBUG_REALTIME_MEMORY = String(process.env.REACT_APP_REALTIME_DEBUG_MEMORY || '').toLowerCase() === 'true'
const DEBUG_ASSET_CONTEXT_LOG = String(process.env.REACT_APP_REALTIME_DEBUG_CONTEXT || '').toLowerCase() === 'true'

function isValidAssetContextPayload(payload) {
  if (!payload || typeof payload !== 'object') return false
  const hasSymbol = typeof payload.symbol === 'string' && payload.symbol.trim().length > 0
  const hasExchangeInfo = payload.exchangeInfo && typeof payload.exchangeInfo === 'object'
  const hasMarket = payload.market && typeof payload.market === 'object'
  const hasAccount = payload.account && typeof payload.account === 'object'
  return hasSymbol || hasExchangeInfo || hasMarket || hasAccount
}

export function useFuturesAssetRealtime(
  symbol,
  intervals,
  options = {},
) {
  const safeIntervals = Array.isArray(intervals) && intervals.length > 0 ? intervals : null
  if (!safeIntervals && symbol) {
    // eslint-disable-next-line no-console
    console.warn(
      '[useFuturesAssetRealtime] called without intervals — candles will not subscribe. ' +
        'Pass an explicit interval array (e.g. INTERVALS from domain/timeframes).',
      { symbol },
    )
  }
  const orderFlowEnabled = options?.orderFlowEnabled !== false
  const intervalsKey = (safeIntervals ?? []).join(',')
  const stableIntervals = useMemo(() => intervalsKey.split(',').filter(Boolean), [intervalsKey])

  useEffect(() => {
    if (!symbol) return undefined
    const { register, unregister } = useSubscriptionPlanStore.getState()
    stableIntervals.forEach((iv) => register(symbol, 'candles', iv))
    register(symbol, 'orderbook')
    register(symbol, 'ticker')
    if (orderFlowEnabled) register(symbol, 'trades')
    return () => {
      stableIntervals.forEach((iv) => unregister(symbol, 'candles', iv))
      unregister(symbol, 'orderbook')
      unregister(symbol, 'ticker')
      if (orderFlowEnabled) unregister(symbol, 'trades')
    }
  }, [symbol, stableIntervals, orderFlowEnabled])

  const recordEvent = useRealtimeMetricsStore.getState().recordEvent

  const prevSymbolRef = useRef(null)
  const lastCandleEventRef = useRef({})
  const lastCandleOpenRef = useRef({})
  const lastCandleRecoveryAttemptRef = useRef({})
  const droppedRealtimeRef = useRef({ book: 0, trades: 0, cvd: 0, frame: 0 })
  const pendingOrderBookRef = useRef(null)
  const pendingTradesRef = useRef([])
  const pendingCvdRef = useRef(null)
  const pendingFrameRef = useRef({ candles: new Map() })
  const flushRafRef = useRef(null)
  const orderFlowFlushTimerRef = useRef(null)
  const marketFrameFlushTimerRef = useRef(null)
  const candleRecoveryTimerRef = useRef(null)
  const memoryDebugTimerRef = useRef(null)
  const metricQueueRef = useRef(new Map())
  const metricFlushTimerRef = useRef(null)

  const isStaleEvent = (data, maxAgeMs = MAX_EVENT_AGE_MS) => {
    const eventTime = extractEventTime(data)
    if (eventTime == null) return false
    return Date.now() - eventTime > maxAgeMs
  }

  const metricDrop = (stream) => {
    droppedRealtimeRef.current[stream] = (droppedRealtimeRef.current[stream] ?? 0) + 1
    if (droppedRealtimeRef.current[stream] % 50 === 0) {
      metric(`client.drop.${stream}`, { dropped: droppedRealtimeRef.current[stream], reason: 'stale' }, 50)
    }
  }

  const scheduleMetricFlush = () => {
    if (metricFlushTimerRef.current != null) return
    metricFlushTimerRef.current = setTimeout(() => {
      metricFlushTimerRef.current = null
      const queued = metricQueueRef.current
      metricQueueRef.current = new Map()
      queued.forEach((entry, stream) => {
        recordEvent(symbol, stream, entry.payload, entry.count, {
          clientReceivedAt: entry.receivedAt,
          clientReceivedAtWall: entry.receivedAtWall,
        })
      })
    }, METRIC_FLUSH_MS)
  }

  const metric = (stream, payload, count = 1) => {
    if (!stream) return
    const receivedAt = performance.now()
    const receivedAtWall = Date.now()
    const prev = metricQueueRef.current.get(stream)
    const safeCount = Number.isFinite(Number(count)) && Number(count) > 0 ? Number(count) : 1
    metricQueueRef.current.set(stream, {
      payload,
      count: (prev?.count ?? 0) + safeCount,
      receivedAt,
      receivedAtWall,
    })
    scheduleMetricFlush()
  }

  const flushMarketFrame = () => {
    const frame = pendingFrameRef.current
    pendingFrameRef.current = { candles: new Map() }

    if (frame.ticker) useMarketDataStore.getState().setTicker(symbol, frame.ticker)
    if (frame.markPrice) useMarketDataStore.getState().setMarkPrice(symbol, frame.markPrice)
    if (frame.indicators?.interval) useMarketDataStore.getState().setIndicators(symbol, frame.indicators.interval, frame.indicators)
    if (frame.footprint) {
      useOrderFlowStore.getState().setFootprint(symbol, frame.footprint)
      useOrderFlowStore.getState().upsertFootprint(symbol, frame.footprint, MAX_FOOTPRINTS_IN_MEMORY)
    }
    if (frame.signalUpdate) useSignalStore.getState().setSignalUpdate(symbol, frame.signalUpdate)
    if (frame.decisionTape) useSignalStore.getState().setDecisionTape(symbol, frame.decisionTape)
    if (frame.liquidityShift) useSignalStore.getState().prependLiquidityShift(symbol, frame.liquidityShift, 100)
    if (frame.spoofingCandidate) useSignalStore.getState().prependSpoofingCandidate(symbol, frame.spoofingCandidate, 50)

    if (frame.localBook) {
      const normalized = normalizeBackendBook(frame.localBook)
      const topOfBook = topOfBookFromMetrics(normalized.bookMetrics) ?? {
        bestBid: normalized.bestBid,
        bestAsk: normalized.bestAsk,
        spread: normalized.spread,
        spreadPct: normalized.spreadPct,
        midPrice: normalized.midPrice,
        isValidTopOfBook: normalized.isValidTopOfBook,
      }
      useOrderBookStore.getState().setOrderBook(symbol, normalized, topOfBook)
      useOrderBookStore.getState().setLocalBook(symbol, normalized)
    }

    frame.candles.forEach(({ candle, maxLength }, interval) => {
      useMarketDataStore.getState().upsertCandle(symbol, interval, candle, maxLength)
    })
  }

  const scheduleMarketFrameFlush = () => {
    if (marketFrameFlushTimerRef.current != null) return
    marketFrameFlushTimerRef.current = setTimeout(() => {
      marketFrameFlushTimerRef.current = null
      flushMarketFrame()
    }, MARKET_FRAME_FLUSH_MS)
  }

  const queueFramePatch = (patch) => {
    const frame = pendingFrameRef.current
    if (patch.ticker) frame.ticker = patch.ticker
    if (patch.markPrice) frame.markPrice = patch.markPrice
    if (patch.indicators) frame.indicators = patch.indicators
    if (patch.footprint) frame.footprint = patch.footprint
    if (patch.signalUpdate) frame.signalUpdate = patch.signalUpdate
    if (patch.decisionTape) frame.decisionTape = patch.decisionTape
    if (patch.liquidityShift) frame.liquidityShift = patch.liquidityShift
    if (patch.spoofingCandidate) frame.spoofingCandidate = patch.spoofingCandidate
    if (patch.localBook) frame.localBook = patch.localBook
    if (patch.candle?.interval && patch.candle?.payload) {
      frame.candles.set(patch.candle.interval, {
        candle: patch.candle.payload,
        maxLength: patch.candle.maxLength ?? MAX_CANDLES_IN_MEMORY,
      })
    }
    scheduleMarketFrameFlush()
  }

  const scheduleOrderBookFlush = () => {
    if (flushRafRef.current != null) return
    flushRafRef.current = requestAnimationFrame(() => {
      flushRafRef.current = null

      const pendingBook = pendingOrderBookRef.current
      if (pendingBook) {
        pendingOrderBookRef.current = null
        const normalized = normalizeBackendBook(pendingBook)
        useOrderBookStore.getState().setOrderBook(symbol, normalized, topOfBookFromMetrics(pendingBook.bookMetrics))
        useFuturesConnectionStore.getState().setHealth(symbol, {
          bookSynced: normalized.isValidTopOfBook,
          lastUpdateAgeMs: 0,
        })
      }
    })
  }

  const flushOrderFlow = () => {
    if (pendingTradesRef.current.length > 0) {
      const batch = pendingTradesRef.current.slice(-MAX_PENDING_TRADES)
      pendingTradesRef.current = []
      useOrderFlowStore.getState().prependTrades(symbol, batch, MAX_TRADES_IN_MEMORY)
    }

    if (pendingCvdRef.current) {
      const cvdEvent = pendingCvdRef.current
      pendingCvdRef.current = null
      useOrderFlowStore.getState().appendCvd(symbol, cvdEvent, MAX_CVD_POINTS_IN_MEMORY)
    }
  }

  const scheduleOrderFlowFlush = () => {
    if (orderFlowFlushTimerRef.current != null) return
    orderFlowFlushTimerRef.current = setTimeout(() => {
      orderFlowFlushTimerRef.current = null
      flushOrderFlow()
      if (pendingTradesRef.current.length > 0 || pendingCvdRef.current) {
        scheduleOrderFlowFlush()
      }
    }, ORDERFLOW_FLUSH_MS)
  }

  const markCandleProgress = (interval, candlesOrPayload, options = {}) => {
    if (!interval) return
    const touchHeartbeat = options?.touchHeartbeat === true
    const now = Date.now()

    if (touchHeartbeat) {
      lastCandleEventRef.current[interval] = now
    }

    if (Array.isArray(candlesOrPayload)) {
      const last = candlesOrPayload[candlesOrPayload.length - 1]
      const openTime = extractCandleOpenTime(last)
      if (openTime != null && openTime !== lastCandleOpenRef.current[interval]) {
        lastCandleOpenRef.current[interval] = openTime
        lastCandleEventRef.current[interval] = now
      }
      return
    }

    const candle = extractCandlePayload(candlesOrPayload)
    const openTime = extractCandleOpenTime(candle)
    if (openTime != null && openTime !== lastCandleOpenRef.current[interval]) {
      lastCandleOpenRef.current[interval] = openTime
      lastCandleEventRef.current[interval] = now
    }
  }

  useEffect(() => {
    if (!symbol) return

    prevSymbolRef.current = symbol

    useFuturesConnectionStore.getState().resetSymbol(symbol)
    useMarketDataStore.getState().resetSymbol(symbol)
    useOrderBookStore.getState().resetSymbol(symbol)
    useOrderFlowStore.getState().resetSymbol(symbol)
    useSignalStore.getState().resetSymbol(symbol)
    usePortfolioStore.getState().resetSymbol(symbol)
    usePaperTradeStore.getState().resetSymbol(symbol)
    useRealtimeMetricsStore.getState().pruneSymbol(symbol)
    lastCandleEventRef.current = {}
    lastCandleOpenRef.current = {}
    lastCandleRecoveryAttemptRef.current = {}
    droppedRealtimeRef.current = { book: 0, trades: 0, cvd: 0, frame: 0 }
    pendingFrameRef.current = { candles: new Map() }
    pendingOrderBookRef.current = null
    pendingTradesRef.current = []
    pendingCvdRef.current = null
    metricQueueRef.current.clear()

    let cancelled = false

    const handleConnection = (status) => {
      useFuturesConnectionStore.getState().setConnectionStatus(status)
      if (status === 'connected') {
        useFuturesConnectionStore.getState().incrementWsReconnect(symbol)
      }
    }

    const cleanupConnection = onConnectionChange(handleConnection)
    useFuturesConnectionStore.getState().setConnectionStatus(getConnectionStatus())

    stableIntervals.forEach((interval) => {
      fetchCandles(symbol, interval, 100)
        .then((data) => {
          if (!cancelled) {
            markCandleProgress(interval, data)
            useMarketDataStore.getState().setCandles(symbol, interval, data)
          }
        })
        .catch(() => {})
    })

    // Hydrate persisted paper positions on symbol init so signal/position
    // state stays consistent after page reload even if Paper UI is not mounted.
    fetchPaperPositions({ symbol, limit: 200, page: 1 })
      .then((res) => {
        if (cancelled) return
        usePaperTradeStore.getState().hydrateSymbol(symbol, res?.items ?? [])
      })
      .catch(() => {})

    const sameSymbol = (data) => {
      const payloadSymbol = extractSymbol(data)
      return !payloadSymbol || payloadSymbol.toUpperCase() === symbol.toUpperCase()
    }

    const handleContext = (data) => {
      if (!sameSymbol(data)) return
      if (!isValidAssetContextPayload(data)) {
        useFuturesConnectionStore.getState().setSocketError(symbol, 'Invalid ASSET_CONTEXT payload received')
        return
      }
      metric('asset.context', data)
      if (DEBUG_ASSET_CONTEXT_LOG) {
        // eslint-disable-next-line no-console
        console.info('[futures:asset:context] received', {
          symbol,
          positions: Array.isArray(data?.account?.positions) ? data.account.positions.length : null,
          openOrders: Array.isArray(data?.account?.openOrders) ? data.account.openOrders.length : null,
        })
      }
      const ctx = normalizeServerContext(data)
      useMarketDataStore.getState().setServerContext(symbol, ctx)
      if (ctx?.positions) usePortfolioStore.getState().setPositions(symbol, ctx.positions)
      if (ctx?.openOrders) usePortfolioStore.getState().setOpenOrders(symbol, ctx.openOrders)
      if (ctx?.availableBalance != null) usePortfolioStore.getState().setLiveBalance(ctx.availableBalance)
    }

    const handleTicker = (data) => {
      if (!sameSymbol(data)) return
      if (isStaleEvent(data)) return metricDrop('frame')
      metric('market.ticker', data)
      queueFramePatch({ ticker: data })
    }

    const handleOrderBook = (data) => {
      if (!sameSymbol(data)) return
      if (isStaleEvent(data)) return metricDrop('book')
      metric('book.partial', data)
      pendingOrderBookRef.current = data
      if (data?.bookMetrics) {
        useOrderBookStore.getState().setBookMetrics(symbol, data.bookMetrics)
      }
      scheduleOrderBookFlush()
    }

    const handleBookMetrics = (data) => {
      if (!sameSymbol(data)) return
      metric('book.metrics', data)
      useOrderBookStore.getState().setBookMetrics(symbol, data)
    }

    const handleCandle = (data) => {
      if (!sameSymbol(data)) return
      const interval = extractInterval(data)
      const candle = extractCandlePayload(data)
      if (!interval) return
      metric(`market.candle.${interval}`, data)
      if (extractCandleOpenTime(candle) == null) return
      markCandleProgress(interval, candle, { touchHeartbeat: true })
      if (data?.indicators) {
        queueFramePatch({ indicators: data.indicators })
      }
      const candleWithMeta = candle?._meta ? candle : { ...candle, _meta: data?._meta }
      queueFramePatch({ candle: { interval, payload: candleWithMeta, maxLength: MAX_CANDLES_IN_MEMORY } })
    }

    const handleSessionCandleSnapshot = (data) => {
      if (!sameSymbol(data)) return
      const interval = data?.interval
      if (!interval) return
      metric(`session.candle.${interval}`, data)
      if (data?.indicators) {
        queueFramePatch({ indicators: { ...data.indicators, interval } })
      }
      if (data?.currentCandle) {
        queueFramePatch({ candle: { interval, payload: data.currentCandle, maxLength: MAX_CANDLES_IN_MEMORY } })
      } else if (data?.latestClosedCandle) {
        queueFramePatch({ candle: { interval, payload: data.latestClosedCandle, maxLength: MAX_CANDLES_IN_MEMORY } })
      }
      if (data?.footprint) {
        queueFramePatch({ footprint: { symbol, interval, footprint: trimFootprintLevels(data.footprint) } })
      }
    }

    const handleIndicators = (data) => {
      if (!sameSymbol(data)) return
      const interval = data?.interval ?? data?.i
      if (!interval) return
      metric(`market.indicators.${interval}`, data)
      queueFramePatch({ indicators: { ...data, interval } })
    }

    const handleMarkPrice = (data) => {
      if (!sameSymbol(data)) return
      if (isStaleEvent(data)) return metricDrop('frame')
      metric('market.markPrice', data)
      queueFramePatch({ markPrice: data })
    }

    const handleTrades = (data) => {
      if (!orderFlowEnabled) return
      const batch = Array.isArray(data) ? data : [data]
      const valid = batch.filter((event) => sameSymbol(event) && !isStaleEvent(event, MAX_TRADE_BATCH_AGE_MS))
      const dropped = batch.length - valid.length
      if (dropped > 0) droppedRealtimeRef.current.trades += dropped
      if (valid.length === 0) return
      metric('trade.agg', valid[valid.length - 1], valid.length)
      pendingTradesRef.current.push(...valid)
      if (pendingTradesRef.current.length > MAX_PENDING_TRADES) {
        pendingTradesRef.current = pendingTradesRef.current.slice(-MAX_PENDING_TRADES)
      }
      scheduleOrderFlowFlush()
    }

    const handleError = (data) => {
      metric('asset.error', data)
      useFuturesConnectionStore.getState().setSocketError(symbol, data?.message ?? String(data))
    }

    const handleCvd = (data) => {
      if (!orderFlowEnabled) return
      if (!sameSymbol(data)) return
      if (isStaleEvent(data, MAX_TRADE_BATCH_AGE_MS)) return metricDrop('cvd')
      metric('orderflow.cvd', data)
      pendingCvdRef.current = data
      scheduleOrderFlowFlush()
    }

    const handleFootprint = (data) => {
      if (!sameSymbol(data)) return
      if (isStaleEvent(data)) return metricDrop('frame')
      metric('orderflow.footprint', data)
      queueFramePatch({
        footprint: {
          ...data,
          footprint: data?.footprint ? trimFootprintLevels(data.footprint) : data?.footprint,
        },
      })
    }

    const handleFootprintInit = (data) => {
      if (!sameSymbol(data)) return
      const footprints = data?.footprints
      if (!footprints || typeof footprints !== 'object') return
      Object.entries(footprints).forEach(([interval, list]) => {
        if (Array.isArray(list)) {
          useOrderFlowStore.getState().setFootprintHistory(
            symbol,
            interval,
            list.map(trimFootprintLevels),
            MAX_FOOTPRINTS_IN_MEMORY,
          )
        }
      })
    }

    const handleLocalBook = (data) => {
      if (!sameSymbol(data)) return
      if (isStaleEvent(data)) return metricDrop('book')
      metric('book.local', data)
      if (data?.bookMetrics) {
        useOrderBookStore.getState().setBookMetrics(symbol, data.bookMetrics)
      }
      queueFramePatch({ localBook: data })
    }

    const handleBookHealth = (data) => {
      if (!sameSymbol(data)) return
      metric('book.health', data)
      useFuturesConnectionStore.getState().setHealth(symbol, {
        ...(data.bookSynced != null && { bookSynced: data.bookSynced }),
        ...(data.lastUpdateAgeMs != null && { lastUpdateAgeMs: data.lastUpdateAgeMs }),
        ...(data.resyncCount != null && { resyncCount: data.resyncCount }),
        ...(data.gapCount != null && { gapCount: data.gapCount }),
        ...(data.depthQueueBacklog != null && { depthQueueBacklog: data.depthQueueBacklog }),
        ...(data.depthDropped != null && { depthDropped: data.depthDropped }),
        ...(data.depthStaleDropped != null && { depthStaleDropped: data.depthStaleDropped }),
        ...(data.depthCoalesced != null && { depthCoalesced: data.depthCoalesced }),
      })
    }

    const handleLiquidityShift = (data) => {
      if (!sameSymbol(data)) return
      if (isStaleEvent(data)) return metricDrop('frame')
      metric('liquidity.shift', data)
      queueFramePatch({ liquidityShift: data })
    }

    const handleSpoofing = (data) => {
      if (!sameSymbol(data)) return
      if (isStaleEvent(data)) return metricDrop('frame')
      metric('spoofing.candidate', data)
      queueFramePatch({ spoofingCandidate: data })
    }

    const handleSignalUpdate = (data) => {
      if (!sameSymbol(data)) return
      if (isStaleEvent(data)) return metricDrop('frame')
      metric('signal.update', data)
      queueFramePatch({ signalUpdate: data })
    }

    const handleDecisionTape = (data) => {
      if (!sameSymbol(data)) return
      metric('decision.tape', data)
      queueFramePatch({ decisionTape: data })
    }

    const handlePaperTradeOpened = (data) => {
      if (!sameSymbol(data)) return
      metric('paperTrade.opened', data)
      usePaperTradeStore.getState().onOpened(symbol, data)
    }

    const handlePaperTradeUpdated = (data) => {
      if (!sameSymbol(data)) return
      metric('paperTrade.updated', data)
      usePaperTradeStore.getState().onUpdated(symbol, data)
    }

    const handlePaperTradeClosed = (data) => {
      if (!sameSymbol(data)) return
      metric('paperTrade.closed', data)
      usePaperTradeStore.getState().onClosed(symbol, data)
    }

    onEvent(FUTURES_SOCKET_EVENTS.ASSET_CONTEXT, handleContext)
    onEvent(FUTURES_SOCKET_EVENTS.MARKET_TICKER, handleTicker)
    onEvent(FUTURES_SOCKET_EVENTS.BOOK_PARTIAL, handleOrderBook)
    onEvent(FUTURES_SOCKET_EVENTS.BOOK_LOCAL, handleLocalBook)
    onEvent(FUTURES_SOCKET_EVENTS.BOOK_METRICS, handleBookMetrics)
    onEvent(FUTURES_SOCKET_EVENTS.BOOK_HEALTH, handleBookHealth)
    onEvent(FUTURES_SOCKET_EVENTS.MARKET_CANDLE, handleCandle)
    onEvent(FUTURES_SOCKET_EVENTS.MARKET_INDICATORS, handleIndicators)
    onEvent(FUTURES_SOCKET_EVENTS.SESSION_CANDLE_SNAPSHOT, handleSessionCandleSnapshot)
    onEvent(FUTURES_SOCKET_EVENTS.MARKET_MARK_PRICE, handleMarkPrice)
    onEvent(FUTURES_SOCKET_EVENTS.TRADE_AGG, handleTrades)
    onEvent(FUTURES_SOCKET_EVENTS.ASSET_ERROR, handleError)
    onEvent(FUTURES_SOCKET_EVENTS.ORDERFLOW_CVD, handleCvd)
    onEvent(FUTURES_SOCKET_EVENTS.ORDERFLOW_FOOTPRINT, handleFootprint)
    onEvent(FUTURES_SOCKET_EVENTS.ORDERFLOW_FOOTPRINT_INIT, handleFootprintInit)
    onEvent(FUTURES_SOCKET_EVENTS.LIQUIDITY_SHIFT, handleLiquidityShift)
    onEvent(FUTURES_SOCKET_EVENTS.SPOOFING_CANDIDATE, handleSpoofing)
    onEvent(FUTURES_SOCKET_EVENTS.SIGNAL_UPDATE, handleSignalUpdate)
    onEvent(FUTURES_SOCKET_EVENTS.DECISION_TAPE, handleDecisionTape)
    onEvent(FUTURES_SOCKET_EVENTS.PAPER_TRADE_OPENED, handlePaperTradeOpened)
    onEvent(FUTURES_SOCKET_EVENTS.PAPER_TRADE_UPDATED, handlePaperTradeUpdated)
    onEvent(FUTURES_SOCKET_EVENTS.PAPER_TRADE_CLOSED, handlePaperTradeClosed)

    candleRecoveryTimerRef.current = setInterval(() => {
      const now = Date.now()
      stableIntervals.forEach((interval) => {
        const intervalMs = intervalToMs(interval)
        const staleThreshold = Math.max(MIN_CANDLE_STALE_RECOVERY_MS, intervalMs * 2)
        const lastSeenAt = Number(lastCandleEventRef.current[interval] ?? 0)
        if (lastSeenAt > 0 && now - lastSeenAt < staleThreshold) return

        const lastRecoveryAt = Number(lastCandleRecoveryAttemptRef.current[interval] ?? 0)
        if (lastRecoveryAt > 0 && now - lastRecoveryAt < CANDLE_RECOVERY_COOLDOWN_MS) return

        lastCandleRecoveryAttemptRef.current[interval] = now
        fetchCandles(symbol, interval, 120)
          .then((data) => {
            if (cancelled || !Array.isArray(data) || data.length === 0) return
            useMarketDataStore.getState().setCandles(symbol, interval, data)
            markCandleProgress(interval, data, { touchHeartbeat: true })
            metric(`market.candle.${interval}.recovery`, data[data.length - 1] ?? null)
          })
          .catch(() => {})
      })
    }, CANDLE_RECOVERY_CHECK_MS)

    if (DEBUG_REALTIME_MEMORY) {
      memoryDebugTimerRef.current = setInterval(() => {
        const market = useMarketDataStore.getState()
        const orderBook = useOrderBookStore.getState()
        const orderFlow = useOrderFlowStore.getState()
        const signal = useSignalStore.getState()
        const candles = market.candlesBySymbol?.[symbol] ?? {}
        const footprints = orderFlow.footprintHistoryBySymbol?.[symbol] ?? new Map()
        const localBook = orderBook.localBookBySymbol?.[symbol]
        const domBook = orderBook.orderBookBySymbol?.[symbol]
        const metrics = orderBook.bookMetricsBySymbol?.[symbol]
        const heap = performance?.memory
          ? {
              usedMB: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
              totalMB: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
              limitMB: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024),
            }
          : null

        // eslint-disable-next-line no-console
        console.info('[realtime-memory]', {
          symbol,
          heap,
          socket: getSocketDebugSnapshot(),
          store: {
            candles: Object.fromEntries(
              Object.entries(candles).map(([interval, list]) => [interval, Array.isArray(list) ? list.length : 0]),
            ),
            orderBookLevels: {
              bids: Array.isArray(domBook?.bids) ? domBook.bids.length : 0,
              asks: Array.isArray(domBook?.asks) ? domBook.asks.length : 0,
            },
            localBookLevels: {
              bids: Array.isArray(localBook?.bids) ? localBook.bids.length : 0,
              asks: Array.isArray(localBook?.asks) ? localBook.asks.length : 0,
            },
            heatmapLevels: {
              bids: Array.isArray(metrics?.heatmapSnapshot?.bids) ? metrics.heatmapSnapshot.bids.length : 0,
              asks: Array.isArray(metrics?.heatmapSnapshot?.asks) ? metrics.heatmapSnapshot.asks.length : 0,
            },
            trades: orderFlow.recentTradesBySymbol?.[symbol]?.length ?? 0,
            cvd: orderFlow.cvdHistoryBySymbol?.[symbol]?.length ?? 0,
            footprints: footprints instanceof Map
              ? Object.fromEntries(
                  Array.from(footprints.entries()).map(([interval, list]) => [
                    interval,
                    Array.isArray(list) ? list.length : 0,
                  ]),
                )
              : {},
            liquidityShifts: signal.liquidityShiftsBySymbol?.[symbol]?.length ?? 0,
            spoofingCandidates: signal.spoofingCandidatesBySymbol?.[symbol]?.length ?? 0,
          },
        })
      }, 10_000)
    }

    return () => {
      cancelled = true
      if (flushRafRef.current != null) {
        cancelAnimationFrame(flushRafRef.current)
        flushRafRef.current = null
      }
      if (orderFlowFlushTimerRef.current != null) {
        clearTimeout(orderFlowFlushTimerRef.current)
        orderFlowFlushTimerRef.current = null
      }
      if (marketFrameFlushTimerRef.current != null) {
        clearTimeout(marketFrameFlushTimerRef.current)
        marketFrameFlushTimerRef.current = null
      }
      if (metricFlushTimerRef.current != null) {
        clearTimeout(metricFlushTimerRef.current)
        metricFlushTimerRef.current = null
      }
      if (candleRecoveryTimerRef.current != null) {
        clearInterval(candleRecoveryTimerRef.current)
        candleRecoveryTimerRef.current = null
      }
      if (memoryDebugTimerRef.current != null) {
        clearInterval(memoryDebugTimerRef.current)
        memoryDebugTimerRef.current = null
      }
      metricQueueRef.current.clear()
      pendingOrderBookRef.current = null
      pendingTradesRef.current = []
      pendingCvdRef.current = null
      pendingFrameRef.current = { candles: new Map() }
      cleanupConnection()
      offEvent(FUTURES_SOCKET_EVENTS.ASSET_CONTEXT, handleContext)
      offEvent(FUTURES_SOCKET_EVENTS.MARKET_TICKER, handleTicker)
      offEvent(FUTURES_SOCKET_EVENTS.BOOK_PARTIAL, handleOrderBook)
      offEvent(FUTURES_SOCKET_EVENTS.BOOK_LOCAL, handleLocalBook)
      offEvent(FUTURES_SOCKET_EVENTS.BOOK_METRICS, handleBookMetrics)
      offEvent(FUTURES_SOCKET_EVENTS.BOOK_HEALTH, handleBookHealth)
      offEvent(FUTURES_SOCKET_EVENTS.MARKET_CANDLE, handleCandle)
      offEvent(FUTURES_SOCKET_EVENTS.MARKET_INDICATORS, handleIndicators)
      offEvent(FUTURES_SOCKET_EVENTS.SESSION_CANDLE_SNAPSHOT, handleSessionCandleSnapshot)
      offEvent(FUTURES_SOCKET_EVENTS.MARKET_MARK_PRICE, handleMarkPrice)
      offEvent(FUTURES_SOCKET_EVENTS.TRADE_AGG, handleTrades)
      offEvent(FUTURES_SOCKET_EVENTS.ASSET_ERROR, handleError)
      offEvent(FUTURES_SOCKET_EVENTS.ORDERFLOW_CVD, handleCvd)
      offEvent(FUTURES_SOCKET_EVENTS.ORDERFLOW_FOOTPRINT, handleFootprint)
      offEvent(FUTURES_SOCKET_EVENTS.ORDERFLOW_FOOTPRINT_INIT, handleFootprintInit)
      offEvent(FUTURES_SOCKET_EVENTS.LIQUIDITY_SHIFT, handleLiquidityShift)
      offEvent(FUTURES_SOCKET_EVENTS.SPOOFING_CANDIDATE, handleSpoofing)
      offEvent(FUTURES_SOCKET_EVENTS.SIGNAL_UPDATE, handleSignalUpdate)
      offEvent(FUTURES_SOCKET_EVENTS.DECISION_TAPE, handleDecisionTape)
      offEvent(FUTURES_SOCKET_EVENTS.PAPER_TRADE_OPENED, handlePaperTradeOpened)
      offEvent(FUTURES_SOCKET_EVENTS.PAPER_TRADE_UPDATED, handlePaperTradeUpdated)
      offEvent(FUTURES_SOCKET_EVENTS.PAPER_TRADE_CLOSED, handlePaperTradeClosed)
      prevSymbolRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, intervalsKey, stableIntervals, orderFlowEnabled])

  const connectionStatus = useFuturesConnectionStore((s) => s.connectionStatus)
  return { connectionStatus }
}
