import React, { useRef, useEffect, useCallback } from 'react'
import { Box } from '@mui/material'
import * as d3 from 'd3'

function isFinitePositive(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0
}

function buildSafeCandles(candles) {
  if (!Array.isArray(candles)) return []
  return candles.filter(
    (c) =>
      Number.isFinite(Number(c?.openTime)) &&
      isFinitePositive(c?.open) &&
      isFinitePositive(c?.high) &&
      isFinitePositive(c?.low) &&
      isFinitePositive(c?.close) &&
      Number.isFinite(Number(c?.volume)) &&
      Number(c?.volume) >= 0,
  )
}

function buildLiquidityWalls(orderBook, priceMin, priceMax) {
  if (!orderBook) return []

  const levels = [
    ...(orderBook.bids || []).map((level) => ({ ...level, side: 'bid' })),
    ...(orderBook.asks || []).map((level) => ({ ...level, side: 'ask' })),
  ].filter(
    (level) =>
      Number.isFinite(level.price) &&
      Number.isFinite(level.quantity) &&
      level.price >= priceMin &&
      level.price <= priceMax,
  )

  const top = levels.sort((a, b) => b.quantity - a.quantity).slice(0, 4)
  const maxQty = d3.max(top, (d) => d.quantity) || 1

  return top.map((level) => ({
    ...level,
    strength: Math.max(0.15, level.quantity / maxQty),
  }))
}

export default function CandleOverlayLayerD3({
  candles = [],
  height = 340,
  orderBook = null,
}) {
  const svgRef = useRef(null)
  const containerRef = useRef(null)

  const render = useCallback(() => {
    const safeCandles = buildSafeCandles(candles)
    if (!svgRef.current || !containerRef.current || safeCandles.length < 2) return

    const totalWidth = containerRef.current.clientWidth
    const margin = { top: 10, right: 78, bottom: 40, left: 10 }
    const volH = 48
    const gap = 6
    const innerW = totalWidth - margin.left - margin.right
    const chartH = height - margin.top - margin.bottom - volH - gap

    const priceMin = d3.min(safeCandles, (d) => +d.low)
    const priceMax = d3.max(safeCandles, (d) => +d.high)
    if (!Number.isFinite(priceMin) || !Number.isFinite(priceMax)) return
    const pRange = priceMax - priceMin || 1
    const domainMin = priceMin - pRange * 0.018
    const domainMax = priceMax + pRange * 0.035

    const xBand = d3
      .scaleBand()
      .domain(safeCandles.map((d) => d.openTime))
      .range([0, innerW])
      .padding(0.15)

    const yPrice = d3.scaleLinear().domain([domainMin, domainMax]).range([chartH, 0])

    const svg = d3.select(svgRef.current)
    svg.attr('width', totalWidth).attr('height', height)

    const g = svg
      .selectAll('g.root')
      .data([null])
      .join('g')
      .attr('class', 'root')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    const wallData = buildLiquidityWalls(orderBook, domainMin, domainMax)
    const wallG = g.selectAll('g.layer-walls').data([null]).join('g').attr('class', 'layer-walls')

    wallG
      .selectAll('.wall-band')
      .data(wallData)
      .join('line')
      .attr('class', 'wall-band')
      .attr('x1', innerW * 0.74)
      .attr('x2', innerW - 12)
      .attr('y1', (d) => yPrice(d.price))
      .attr('y2', (d) => yPrice(d.price))
      .attr('stroke', (d) => (d.side === 'bid' ? '#22C55E' : '#EF4444'))
      .attr('stroke-width', (d) => 0.6 + d.strength * 1.6)
      .attr('stroke-opacity', (d) => 0.12 + d.strength * 0.18)
      .attr('stroke-linecap', 'round')

    wallG
      .selectAll('.wall-label')
      .data(wallData.slice(0, 1))
      .join('text')
      .attr('class', 'wall-label')
      .attr('x', innerW - 14)
      .attr('y', (d) => Math.max(10, yPrice(d.price) - 8))
      .attr('text-anchor', 'end')
      .attr('font-size', 8)
      .attr('font-weight', 700)
      .attr('fill', (d) => (d.side === 'bid' ? '#86EFAC' : '#FCA5A5'))
      .attr('opacity', 0.48)
      .text((d) => `${d.side === 'bid' ? 'BID' : 'ASK'} ${Number(d.quantity).toFixed(2)}`)

  }, [candles, height, orderBook])

  useEffect(() => {
    render()
  }, [render])

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(() => render())
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [render])

  return (
    <Box
      ref={containerRef}
      sx={{
        position: 'absolute',
        inset: 0,
        zIndex: 1,
        pointerEvents: 'none',
      }}
    >
      <svg ref={svgRef} style={{ display: 'block' }} />
    </Box>
  )
}
