import { useEffect, useState, useCallback } from 'react'
import { onEvent, offEvent } from '../infrastructure/futuresSocketClient'
import { appendCvdPoint } from '../domain/cvd.model'
import { useFeatureSubscription } from './subscriptions/useFeatureSubscription'

const MAX_CVD_HISTORY = 500

function eventSymbol(event) {
  return event?.symbol ?? event?.s ?? null
}

function eventInterval(event) {
  return event?.interval ?? event?.i ?? null
}

/**
 * Subscribes to the server's `futures:orderflow:cvd` stream and maintains
 * a rolling history of CVD points for chart rendering.
 *
 * If `interval` is provided, only events tagged with that timeframe are
 * accepted. Untagged events (legacy backend) are passed through so the chart
 * keeps working until the backend starts emitting `interval` in the payload.
 *
 * TODO(backend tv1): emit `interval` field in `futures:orderflow:cvd`
 * and split CVD accumulator per (symbol, interval) in symbolWorker so each
 * TF has its own series.
 *
 * @param {string}  symbol
 * @param {string} [interval] active timeframe; omit for legacy global stream
 * @returns {{ cvd: number, cvdHistory: import('../domain/cvd.model').CvdPoint[] }}
 */
export function useCvdData(symbol, interval) {
  const [cvd, setCvd] = useState(0)
  const [cvdHistory, setCvdHistory] = useState([])

  useFeatureSubscription(symbol, 'cvd', interval ?? null)

  const handleCvd = useCallback(
    (event) => {
      const payloadSymbol = eventSymbol(event)
      if (payloadSymbol && payloadSymbol !== symbol) return
      const evInterval = eventInterval(event)
      // If interval was requested and the event is tagged with a different TF, drop it.
      // Untagged events (evInterval == null) are accepted as a transitional fallback.
      if (interval && evInterval && evInterval !== interval) return
      setCvd(parseFloat(event.cvd) || 0)
      setCvdHistory((prev) => appendCvdPoint(prev, event, MAX_CVD_HISTORY))
    },
    [symbol, interval],
  )

  useEffect(() => {
    if (!symbol) return undefined

    setCvd(0)
    setCvdHistory([])

    onEvent('futures:orderflow:cvd', handleCvd)
    return () => offEvent('futures:orderflow:cvd', handleCvd)
  }, [symbol, interval, handleCvd])

  return { cvd, cvdHistory }
}
