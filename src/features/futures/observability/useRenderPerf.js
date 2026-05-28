import { useEffect, useRef } from 'react'
import { useRealtimeMetricsStore } from './realtimeMetricsStore'

const MIN_RECORD_INTERVAL_MS = 250

export function useRenderPerf(symbol, componentName) {
  const startedAtRef = useRef(performance.now())
  const lastRecordedAtRef = useRef(0)

  useEffect(() => {
    const now = performance.now()
    const duration = now - startedAtRef.current

    if (symbol && componentName && now - lastRecordedAtRef.current >= MIN_RECORD_INTERVAL_MS) {
      useRealtimeMetricsStore.getState().recordRender(symbol, componentName, duration)
      lastRecordedAtRef.current = now
    }

    startedAtRef.current = now
  })
}
