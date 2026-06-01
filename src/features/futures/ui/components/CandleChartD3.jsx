import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react'
import { Box, ToggleButton, ToggleButtonGroup } from '@mui/material'
import * as d3 from 'd3'
import CandleCountdownTimer from './CandleCountdownTimer'
import { useRealtimeMetricsStore } from '../../observability/realtimeMetricsStore'

const MARGIN = { top: 10, right: 78, bottom: 40, left: 10 }
const VOL_H = 48
const RSI_H = 50
const MACD_H = 60
const GAP = 6
const MAX_RENDER_FPS_MS = 250
const AXIS_REFRESH_MS = 750

function intervalToMs(interval) {
  const m = /^(\d+)([smhdw])$/.exec(interval ?? '')
  if (!m) return 0
  const n = parseInt(m[1], 10)
  const units = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 }
  return n * (units[m[2]] ?? 0)
}

function isFinitePositive(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0
}

function styleAxis(axis, fontSize = '10px') {
  axis.select('.domain').attr('stroke', '#374151')
  axis.selectAll('.tick line').attr('stroke', '#374151')
  axis.selectAll('text').attr('fill', '#9CA3AF').style('font-size', fontSize)
}

function ensureLayer(root, className) {
  return root.selectAll(`g.${className}`).data([null]).join('g').attr('class', className)
}

function backendSeries(candles, key) {
  const values = candles.map((c) => {
    const ind = c?.indicators
    const value =
      key === 'ema20' ? ind?.ema20 :
        key === 'ema50' ? ind?.ema50 :
          key === 'rsi14' ? ind?.rsi14 :
            key === 'macdLine' ? ind?.macd?.line :
              key === 'macdSignal' ? ind?.macd?.signal :
                key === 'macdHistogram' ? ind?.macd?.histogram :
                  null
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  })
  return values.some((v) => v != null) ? values : null
}

function compactNullableSeries(values) {
  if (!Array.isArray(values)) return null
  const first = values.findIndex((v) => v != null)
  return first === -1 ? null : values.slice(first)
}

function isFinitePoint(point) {
  return Number.isFinite(Number(point?.openTime)) && Number.isFinite(Number(point?.v))
}

function contiguousSegments(points) {
  const segments = []
  let current = []

  for (const point of points) {
    if (isFinitePoint(point)) {
      current.push(point)
      continue
    }

    if (current.length >= 2) segments.push(current)
    current = []
  }

  if (current.length >= 2) segments.push(current)
  return segments
}

function CandleChartD3({ candles = [], interval = '', height = 340, symbol = 'UNKNOWN' }) {
  const svgRef = useRef(null)
  const containerRef = useRef(null)
  const rafRef = useRef(null)
  const timeoutRef = useRef(null)
  const lastRenderAtRef = useRef(0)
  const lastAxisRenderAtRef = useRef(0)
  const forceAxisRef = useRef(true)
  const widthRef = useRef(0)
  const pointerInsideRef = useRef(false)

  // Mouse handler is bound once; reads live state via this ref so its closure
  // never retains `safeCandles` (avoids array retention across renders).
  const viewRef = useRef({
    safeCandles: [],
    xBand: null,
    decimals: 2,
    totalWidth: 0,
    chartH: 0,
  })
  const mouseBoundRef = useRef(false)

  const recordRender = useRealtimeMetricsStore((state) => state.recordRender)

  const [showEma, setShowEma] = useState(true)
  const [indicator, setIndicator] = useState('none') // 'none' | 'rsi' | 'macd'
  const showRsi = indicator === 'rsi'
  const showMacd = indicator === 'macd'

  const safeCandles = useMemo(
    () =>
      candles.filter(
        (c) =>
          Number.isFinite(Number(c?.openTime)) &&
          isFinitePositive(c?.open) &&
          isFinitePositive(c?.high) &&
          isFinitePositive(c?.low) &&
          isFinitePositive(c?.close) &&
          Number.isFinite(Number(c?.volume)) &&
          Number(c?.volume) >= 0,
      ),
    [candles],
  )

  const lastCandle = safeCandles[safeCandles.length - 1]
  const intervalMs = useMemo(() => intervalToMs(interval), [interval])

  const ema20 = useMemo(() => {
    if (!showEma) return []
    return compactNullableSeries(backendSeries(safeCandles, 'ema20')) ?? []
  }, [safeCandles, showEma])
  const ema50 = useMemo(() => {
    if (!showEma) return []
    return compactNullableSeries(backendSeries(safeCandles, 'ema50')) ?? []
  }, [safeCandles, showEma])
  const rsi = useMemo(() => {
    if (!showRsi) return []
    return compactNullableSeries(backendSeries(safeCandles, 'rsi14')) ?? []
  }, [safeCandles, showRsi])
  const macd = useMemo(() => {
    if (!showMacd) return null
    const line = compactNullableSeries(backendSeries(safeCandles, 'macdLine'))
    const signal = compactNullableSeries(backendSeries(safeCandles, 'macdSignal'))
    const histogram = compactNullableSeries(backendSeries(safeCandles, 'macdHistogram'))
    if (line?.length && signal?.length && histogram?.length) {
      return { macdLine: line, signalLine: signal, histogram, startIndex: safeCandles.length - histogram.length }
    }
    return null
  }, [safeCandles, showMacd])

  const render = useCallback(() => {
    if (!svgRef.current || !containerRef.current || safeCandles.length < 2) return
    const t0 = performance.now()

    const totalWidth = containerRef.current.clientWidth
    if (!totalWidth) return

    const rsiH = showRsi ? RSI_H : 0
    const macdH = showMacd ? MACD_H : 0
    const extraH = (rsiH > 0 ? rsiH + GAP : 0) + (macdH > 0 ? macdH + GAP : 0)

    const innerW = Math.max(totalWidth - MARGIN.left - MARGIN.right, 1)
    const chartH = Math.max(80, height - MARGIN.top - MARGIN.bottom - VOL_H - GAP - extraH)

    const volTop = chartH + GAP
    const rsiTop = volTop + VOL_H + (rsiH > 0 ? GAP : 0)
    const macdTop = rsiTop + rsiH + (macdH > 0 ? GAP : 0)
    const axisTop = chartH + GAP + VOL_H + extraH

    const svg = d3.select(svgRef.current)
    svg.attr('width', totalWidth).attr('height', height)

    const root = svg
      .selectAll('g.root')
      .data([null])
      .join('g')
      .attr('class', 'root')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)

    const xBand = d3
      .scaleBand()
      .domain(safeCandles.map((d) => d.openTime))
      .range([0, innerW])
      .padding(0.15)

    const priceMin = d3.min(safeCandles, (d) => +d.low)
    const priceMax = d3.max(safeCandles, (d) => +d.high)
    if (!Number.isFinite(priceMin) || !Number.isFinite(priceMax)) return

    const pRange = priceMax - priceMin || 1
    const domainMin = priceMin - pRange * 0.018
    const domainMax = priceMax + pRange * 0.035
    const yPrice = d3.scaleLinear().domain([domainMin, domainMax]).range([chartH, 0])
    const yVol = d3
      .scaleLinear()
      .domain([0, (d3.max(safeCandles, (d) => +d.volume) || 1) * 1.1])
      .range([VOL_H, 0])

    const priceTicks = yPrice.ticks(4)
    const priceStep = priceTicks.length > 1 ? Math.abs(priceTicks[1] - priceTicks[0]) : pRange / 4
    const decimals = priceStep > 0 ? Math.max(0, Math.ceil(-Math.log10(priceStep))) : 2

    const cx = (openTime) => (xBand(openTime) ?? 0) + xBand.bandwidth() / 2

    ensureLayer(root, 'layer-vol')
      .attr('transform', `translate(0,${volTop})`)
      .selectAll('rect')
      .data(safeCandles, (d) => d.openTime)
      .join(
        (enter) => enter.append('rect').attr('opacity', 0.45),
        (update) => update,
        (exit) => exit.remove(),
      )
      .attr('x', (d) => xBand(d.openTime) ?? 0)
      .attr('y', (d) => yVol(+d.volume))
      .attr('width', xBand.bandwidth())
      .attr('height', (d) => Math.max(0, VOL_H - yVol(+d.volume)))
      .attr('fill', (d) => (+d.close >= +d.open ? '#22C55E' : '#EF4444'))

    ensureLayer(root, 'layer-wicks')
      .selectAll('.wick')
      .data(safeCandles, (d) => d.openTime)
      .join(
        (enter) => enter.append('line').attr('class', 'wick').attr('stroke-width', 1),
        (update) => update,
        (exit) => exit.remove(),
      )
      .attr('x1', (d) => cx(d.openTime))
      .attr('x2', (d) => cx(d.openTime))
      .attr('y1', (d) => yPrice(+d.high))
      .attr('y2', (d) => yPrice(+d.low))
      .attr('stroke', (d) => (+d.close >= +d.open ? '#22C55E' : '#EF4444'))

    ensureLayer(root, 'layer-bodies')
      .selectAll('.body')
      .data(safeCandles, (d) => d.openTime)
      .join(
        (enter) => enter.append('rect').attr('class', 'body'),
        (update) => update,
        (exit) => exit.remove(),
      )
      .attr('x', (d) => xBand(d.openTime) ?? 0)
      .attr('y', (d) => yPrice(Math.max(+d.open, +d.close)))
      .attr('width', xBand.bandwidth())
      .attr('height', (d) => Math.max(1, Math.abs(yPrice(+d.open) - yPrice(+d.close))))
      .attr('fill', (d) => (+d.close >= +d.open ? '#22C55E' : '#EF4444'))

    // ── EMA overlays on the price chart ────────────────────────────────────
    const emaLayer = ensureLayer(root, 'layer-ema')
    const drawEma = (series, color, klass) => {
      if (!showEma || series.length < 2) {
        emaLayer.selectAll(`path.${klass}`).remove()
        return
      }
      const aligned = safeCandles
        .slice(safeCandles.length - series.length)
        .map((c, i) => ({ openTime: c.openTime, v: series[i] }))
      const segments = contiguousSegments(aligned)
      if (segments.length === 0) {
        emaLayer.selectAll(`path.${klass}`).remove()
        return
      }
      const line = d3.line()
        .defined(isFinitePoint)
        .x((d) => cx(d.openTime))
        .y((d) => yPrice(Number(d.v)))
      emaLayer
        .selectAll(`path.${klass}`)
        .data(segments)
        .join('path')
        .attr('class', klass)
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', 1.25)
        .attr('d', line)
    }
    drawEma(ema20, '#F59E0B', 'ema20')
    drawEma(ema50, '#3B82F6', 'ema50')

    // ── RSI panel ──────────────────────────────────────────────────────────
    const rsiLayer = ensureLayer(root, 'layer-rsi').attr('transform', `translate(0,${rsiTop})`)
    if (showRsi && rsi.length > 1) {
      const yRsi = d3.scaleLinear().domain([0, 100]).range([RSI_H, 0])
      const aligned = safeCandles
        .slice(safeCandles.length - rsi.length)
        .map((c, i) => ({ openTime: c.openTime, v: rsi[i] }))
      const rsiSegments = contiguousSegments(aligned)
      const line = d3.line()
        .defined(isFinitePoint)
        .x((d) => cx(d.openTime))
        .y((d) => yRsi(Number(d.v)))

      rsiLayer
        .selectAll('line.guide')
        .data([30, 70])
        .join('line')
        .attr('class', 'guide')
        .attr('x1', 0)
        .attr('x2', innerW)
        .attr('y1', (v) => yRsi(v))
        .attr('y2', (v) => yRsi(v))
        .attr('stroke', '#374151')
        .attr('stroke-dasharray', '3,3')

      rsiLayer
        .selectAll('path.rsi')
        .data(rsiSegments)
        .join('path')
        .attr('class', 'rsi')
        .attr('fill', 'none')
        .attr('stroke', '#A855F7')
        .attr('stroke-width', 1.25)
        .attr('d', line)

      rsiLayer
        .selectAll('text.label')
        .data(['RSI(14)'])
        .join('text')
        .attr('class', 'label')
        .attr('x', 4)
        .attr('y', 10)
        .attr('fill', '#9CA3AF')
        .style('font-size', '9px')
        .text((t) => t)
    } else {
      rsiLayer.selectAll('*').remove()
    }

    // ── MACD panel ─────────────────────────────────────────────────────────
    const macdLayer = ensureLayer(root, 'layer-macd').attr('transform', `translate(0,${macdTop})`)
    if (showMacd && macd && macd.histogram.length > 1) {
      const finiteMacdValues = [...macd.macdLine, ...macd.signalLine, ...macd.histogram]
        .map(Number)
        .filter(Number.isFinite)
      const maxAbs = d3.max(finiteMacdValues, (v) => Math.abs(v)) || 1
      const yMacd = d3.scaleLinear().domain([-maxAbs, maxAbs]).range([MACD_H, 0])
      const aligned = safeCandles.slice(safeCandles.length - macd.histogram.length)
      const histData = aligned
        .map((c, i) => ({ openTime: c.openTime, h: Number(macd.histogram[i]) }))
        .filter((d) => Number.isFinite(Number(d.openTime)) && Number.isFinite(d.h))

      macdLayer
        .selectAll('line.zero')
        .data([0])
        .join('line')
        .attr('class', 'zero')
        .attr('x1', 0)
        .attr('x2', innerW)
        .attr('y1', yMacd(0))
        .attr('y2', yMacd(0))
        .attr('stroke', '#374151')

      macdLayer
        .selectAll('rect.hist')
        .data(histData)
        .join('rect')
        .attr('class', 'hist')
        .attr('x', (d) => xBand(d.openTime) ?? 0)
        .attr('y', (d) => (d.h >= 0 ? yMacd(d.h) : yMacd(0)))
        .attr('width', xBand.bandwidth())
        .attr('height', (d) => Math.abs(yMacd(d.h) - yMacd(0)))
        .attr('fill', (d) => (d.h >= 0 ? '#22C55E' : '#EF4444'))
        .attr('opacity', 0.55)

      const macdSegments = contiguousSegments(aligned.map((c, i) => ({ openTime: c.openTime, v: macd.macdLine[i] })))
      const sigSegments = contiguousSegments(aligned.map((c, i) => ({ openTime: c.openTime, v: macd.signalLine[i] })))
      const macdLine = d3.line()
        .defined(isFinitePoint)
        .x((d) => cx(d.openTime))
        .y((d) => yMacd(Number(d.v)))

      macdLayer
        .selectAll('path.macd-line')
        .data(macdSegments)
        .join('path')
        .attr('class', 'macd-line')
        .attr('fill', 'none')
        .attr('stroke', '#3B82F6')
        .attr('stroke-width', 1.1)
        .attr('d', macdLine)

      macdLayer
        .selectAll('path.signal-line')
        .data(sigSegments)
        .join('path')
        .attr('class', 'signal-line')
        .attr('fill', 'none')
        .attr('stroke', '#F59E0B')
        .attr('stroke-width', 1.1)
        .attr('d', macdLine)

      macdLayer
        .selectAll('text.label')
        .data(['MACD(12,26,9)'])
        .join('text')
        .attr('class', 'label')
        .attr('x', 4)
        .attr('y', 10)
        .attr('fill', '#9CA3AF')
        .style('font-size', '9px')
        .text((t) => t)
    } else {
      macdLayer.selectAll('*').remove()
    }

    const now = performance.now()
    const widthChanged = widthRef.current !== totalWidth
    const refreshAxis = forceAxisRef.current || widthChanged || now - lastAxisRenderAtRef.current > AXIS_REFRESH_MS

    if (refreshAxis) {
      widthRef.current = totalWidth
      forceAxisRef.current = false
      lastAxisRenderAtRef.current = now

      ensureLayer(root, 'layer-grid')
        .selectAll('line')
        .data(priceTicks, (d) => d)
        .join(
          (enter) => enter.append('line').attr('stroke', '#1E293B').attr('stroke-dasharray', '3,3'),
          (update) => update,
          (exit) => exit.remove(),
        )
        .attr('x1', 0)
        .attr('x2', innerW)
        .attr('y1', (d) => yPrice(d))
        .attr('y2', (d) => yPrice(d))

      const tickEvery = Math.max(1, Math.ceil(safeCandles.length / 5))
      const xTicks = safeCandles.filter((_, i) => i % tickEvery === 0).map((d) => d.openTime)

      ensureLayer(root, 'layer-x-axis')
        .attr('transform', `translate(0,${axisTop})`)
        .call(
          d3
            .axisBottom(xBand)
            .tickValues(xTicks)
            .tickFormat((d) => {
              const dt = new Date(+d)
              return `${String(dt.getUTCHours()).padStart(2, '0')}:${String(dt.getUTCMinutes()).padStart(2, '0')}`
            }),
        )
        .call((ax) => styleAxis(ax, '9px'))

      ensureLayer(root, 'layer-y-axis')
        .attr('transform', `translate(${innerW},0)`)
        .call(
          d3
            .axisRight(yPrice)
            .tickValues(priceTicks)
            .tickFormat((d) => d3.format(`,.${decimals}f`)(d)),
        )
        .call((ax) => {
          styleAxis(ax, '10px')
          ax.selectAll('text').attr('dx', '6px')
        })
    }

    // Crosshair lines (one-time create; dimensions refreshed each render)
    if (root.select('.crosshair-v').empty()) {
      root.append('line')
        .attr('class', 'crosshair-v')
        .attr('stroke', '#64748B')
        .attr('stroke-opacity', 0.35)
        .attr('stroke-dasharray', '4,2')
        .style('pointer-events', 'none')
        .style('display', 'none')
      root.append('line')
        .attr('class', 'crosshair-h')
        .attr('stroke', '#64748B')
        .attr('stroke-opacity', 0.35)
        .attr('stroke-dasharray', '4,2')
        .style('pointer-events', 'none')
        .style('display', 'none')
    }
    root.select('.crosshair-v').attr('y1', 0).attr('y2', chartH)
    root.select('.crosshair-h').attr('x1', 0).attr('x2', innerW)
    if (!pointerInsideRef.current) {
      root.select('.crosshair-v').style('display', 'none')
      root.select('.crosshair-h').style('display', 'none')
      svg.select('g.tip-group').style('display', 'none')
    }

    // Tip group (one-time create)
    if (svg.select('g.tip-group').empty()) {
      const tipInit = svg
        .append('g')
        .attr('class', 'tip-group')
        .style('display', 'none')
        .style('pointer-events', 'none')
      tipInit.append('rect').attr('class', 'tip-bg').attr('fill', '#0D1117').attr('stroke', '#1E293B').attr('rx', 4)
      tipInit.append('text').attr('class', 'tip-txt').attr('fill', '#F9FAFB').style('font-size', '11px')
    }

    // Mouse overlay rect — listeners bound ONCE (read live state from viewRef).
    const overlay = svg
      .selectAll('rect.mouse-overlay')
      .data([null])
      .join('rect')
      .attr('class', 'mouse-overlay')
      .attr('x', MARGIN.left)
      .attr('y', MARGIN.top)
      .attr('width', innerW)
      .attr('height', chartH)
      .attr('fill', 'transparent')

    if (!mouseBoundRef.current) {
      overlay
        .on('mouseenter', () => {
          pointerInsideRef.current = true
        })
        .on('mousemove', function (event) {
          const v = viewRef.current
          const svgEl = svgRef.current
          if (!svgEl || !v.safeCandles?.length || !v.xBand) return
          const rootSel = d3.select(svgEl).select('g.root')
          if (rootSel.empty()) return
          const [mx, my] = d3.pointer(event, rootSel.node())
          rootSel.select('.crosshair-v').style('display', null).attr('x1', mx).attr('x2', mx)
          rootSel.select('.crosshair-h').style('display', null).attr('y1', my).attr('y2', my)
          const step = v.xBand.step()
          if (!(step > 0)) return
          const idx = Math.min(Math.floor(mx / step), v.safeCandles.length - 1)
          const candle = v.safeCandles[Math.max(0, idx)]
          if (!candle) return
          const tip = d3.select(svgEl).select('g.tip-group')
          const tipBg = tip.select('rect.tip-bg')
          const tipTxt = tip.select('text.tip-txt')
          const lines = [
            `O: ${(+candle.open).toFixed(v.decimals)}   H: ${(+candle.high).toFixed(v.decimals)}`,
            `L: ${(+candle.low).toFixed(v.decimals)}   C: ${(+candle.close).toFixed(v.decimals)}`,
            `Vol: ${(+candle.volume).toFixed(2)}`,
          ]
          tipTxt.selectAll('tspan').remove()
          lines.forEach((line, i) =>
            tipTxt
              .append('tspan')
              .attr('x', 8)
              .attr('dy', i === 0 ? '1.1em' : '1.3em')
              .text(line),
          )
          const bb = tipTxt.node().getBBox()
          tipBg.attr('width', bb.width + 16).attr('height', bb.height + 10)
          let tx = mx + MARGIN.left + 12
          let ty = my + MARGIN.top - 10
          if (tx + bb.width + 20 > v.totalWidth) tx = mx + MARGIN.left - bb.width - 20
          if (ty < 0) ty = 4
          tip.attr('transform', `translate(${tx},${ty})`).style('display', null)
        })
        .on('mouseleave', () => {
          pointerInsideRef.current = false
          const svgEl = svgRef.current
          if (!svgEl) return
          const rootSel = d3.select(svgEl).select('g.root')
          if (!rootSel.empty()) {
            rootSel.select('.crosshair-v').style('display', 'none')
            rootSel.select('.crosshair-h').style('display', 'none')
          }
          d3.select(svgEl).select('g.tip-group').style('display', 'none')
        })
      mouseBoundRef.current = true
    }

    // Publish the latest view to the (already bound) mouse handler.
    viewRef.current = { safeCandles, xBand, decimals, totalWidth, chartH }

    recordRender(symbol, 'CandleChartD3:d3', performance.now() - t0)
  }, [safeCandles, height, recordRender, symbol, showEma, ema20, ema50, showRsi, rsi, showMacd, macd])

  const scheduleRender = useCallback((forceAxis = false) => {
    if (forceAxis) forceAxisRef.current = true
    const now = performance.now()
    const delay = Math.max(0, MAX_RENDER_FPS_MS - (now - lastRenderAtRef.current))
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    if (timeoutRef.current != null) clearTimeout(timeoutRef.current)

    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        lastRenderAtRef.current = performance.now()
        render()
      })
    }, delay)
  }, [render])

  useEffect(() => {
    scheduleRender(false)
    return () => {
      if (timeoutRef.current != null) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [scheduleRender])

  useEffect(() => {
    if (!containerRef.current) return undefined
    const ro = new ResizeObserver(() => scheduleRender(true))
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [scheduleRender])

  // Force axis refresh when toggling indicators (panel positions change).
  useEffect(() => {
    forceAxisRef.current = true
    scheduleRender(true)
  }, [showRsi, showMacd, scheduleRender])

  return (
    <Box ref={containerRef} sx={{ width: '100%', position: 'relative' }}>
      <Box
        sx={{
          position: 'absolute',
          top: 2,
          right: MARGIN.right + 4,
          zIndex: 2,
          display: 'flex',
          gap: 0.5,
          alignItems: 'center',
        }}
      >
        <ToggleButton
          size="small"
          value="ema"
          selected={showEma}
          onChange={() => setShowEma((v) => !v)}
          sx={{ fontSize: 9, py: 0.1, px: 0.75, lineHeight: 1.4 }}
        >
          EMA
        </ToggleButton>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={indicator}
          onChange={(_, v) => setIndicator(v ?? 'none')}
        >
          <ToggleButton value="rsi" sx={{ fontSize: 9, py: 0.1, px: 0.75, lineHeight: 1.4 }}>
            RSI
          </ToggleButton>
          <ToggleButton value="macd" sx={{ fontSize: 9, py: 0.1, px: 0.75, lineHeight: 1.4 }}>
            MACD
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>
      <svg ref={svgRef} style={{ display: 'block' }} />
      <CandleCountdownTimer lastCandleOpenTime={lastCandle?.openTime} intervalMs={intervalMs} />
    </Box>
  )
}

export default React.memo(CandleChartD3)
