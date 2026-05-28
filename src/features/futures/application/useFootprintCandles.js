import { useEffect, useState, useCallback } from 'react'
import { onEvent, offEvent } from '../infrastructure/futuresSocketClient'
import { buildFootprintDisplay, upsertFootprint } from '../domain/footprint.model'
import { fetchFootprintHistory } from '../infrastructure/futuresApiClient'
import { useFeatureSubscription } from './subscriptions/useFeatureSubscription'

function eventSymbol(event) {
  return event?.symbol ?? event?.s ?? event?.footprint?.symbol ?? event?.footprint?.s ?? null
}

/**
 * Subscribes to footprint candle events from the server for a single
 * interval and maintains its history + current open candle.
 *
 * Listens to:
 *   futures:orderflow:footprint:init — full history batch on subscribe
 *   futures:orderflow:footprint      — incremental update per candle close or tick
 *
 * Only events matching the active `interval` are kept; pass a single
 * interval string (e.g. INTERVALS[intervalIdx]) — the previous multi-interval
 * mode was removed to align footprint with the user's selection.
 *
 * @param {string} symbol
 * @param {string} interval  active timeframe (must be a single TF)
 * @returns {{
 *   footprints:        Map<string, import('../domain/footprint.model').FootprintDisplay[]>,
 *   currentFootprints: Map<string, import('../domain/footprint.model').FootprintDisplay>,
 * }}
 */
export function useFootprintCandles(symbol, interval) {
  // Keep Map shape for backwards compatibility with consumers.
  const [footprints, setFootprints] = useState(() => new Map())
  const [currentFootprints, setCurrentFootprints] = useState(() => new Map())

  useFeatureSubscription(symbol, 'footprint', interval ?? null)

  const handleInit = useCallback(
    (data) => {
      const payloadSymbol = eventSymbol(data)
      if (payloadSymbol && payloadSymbol !== symbol) return
      if (!data || !data.footprints) return

      setFootprints((prev) => {
        const next = new Map(prev)
        for (const [iv, rawList] of Object.entries(data.footprints)) {
          if (interval && iv !== interval) continue
          const parsed = rawList.map(buildFootprintDisplay).filter(Boolean)
          next.set(iv, parsed.length > 200 ? parsed.slice(-200) : parsed)
        }
        return next
      })
    },
    [symbol, interval],
  )

  const handleUpdate = useCallback(
    (data) => {
      const payloadSymbol = eventSymbol(data)
      if (payloadSymbol && payloadSymbol !== symbol) return
      if (!data || !data.footprint || !data.interval) return
      if (interval && data.interval !== interval) return

      const fp = buildFootprintDisplay(data.footprint)
      if (!fp) return
      const iv = data.interval

      if (fp.isFinal) {
        setFootprints((prev) => {
          const next = new Map(prev)
          const history = next.get(iv) ?? []
          next.set(iv, upsertFootprint(history, fp))
          return next
        })
        setCurrentFootprints((prev) => {
          const next = new Map(prev)
          next.delete(iv)
          return next
        })
      } else {
        setCurrentFootprints((prev) => {
          const next = new Map(prev)
          next.set(iv, fp)
          return next
        })
      }
    },
    [symbol, interval],
  )

  useEffect(() => {
    if (!symbol || !interval) return undefined

    setFootprints(new Map())
    setCurrentFootprints(new Map())

    onEvent('futures:orderflow:footprint:init', handleInit)
    onEvent('futures:orderflow:footprint', handleUpdate)

    let cancelled = false
    fetchFootprintHistory(symbol, interval, 50)
      .then((rawList) => {
        if (cancelled) return
        setFootprints((prev) => {
          if ((prev.get(interval) ?? []).length > 0) return prev
          const parsed = rawList.map(buildFootprintDisplay).filter(Boolean)
          const next = new Map(prev)
          next.set(interval, parsed)
          return next
        })
      })
      .catch(() => {
        /* silently ignore — chart just starts empty */
      })

    return () => {
      cancelled = true
      offEvent('futures:orderflow:footprint:init', handleInit)
      offEvent('futures:orderflow:footprint', handleUpdate)
    }
  }, [symbol, interval, handleInit, handleUpdate])

  return { footprints, currentFootprints }
}
