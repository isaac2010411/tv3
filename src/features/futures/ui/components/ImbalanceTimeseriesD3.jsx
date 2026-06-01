import React, { useRef, useEffect, useCallback } from 'react';
import { Box } from '@mui/material';
import * as d3 from 'd3';

/**
 * Order-book imbalance time-series chart.
 *
 * Plots imbalance = (bidVol - askVol) / (bidVol + askVol) over time.
 *   Positive (green area) → bid-heavy book
 *   Negative (red area)   → ask-heavy book
 *
 * An EMA-10 smoothing line is overlaid to highlight the trend.
 *
 * Props:
 *   imbalanceHistory  – array of { time: number, value: number } from useLiquidityData
 *   height            – SVG height in px (default 180)
 */
export default function ImbalanceTimeseriesD3({ imbalanceHistory = [], height = 180 }) {
  const svgRef       = useRef(null);
  const containerRef = useRef(null);

  const render = useCallback(() => {
    if (!svgRef.current || !containerRef.current || imbalanceHistory.length < 2) return;

    const pts = imbalanceHistory.filter((point) => Number.isFinite(point?.time) && Number.isFinite(point?.value));
    if (pts.length < 2) return;

    const totalWidth = containerRef.current.clientWidth || 200;
    const margin     = { top: 10, right: 55, bottom: 24, left: 55 };
    const innerW     = Math.max(totalWidth - margin.left - margin.right, 1);
    const innerH     = Math.max(height - margin.top - margin.bottom, 1);

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', totalWidth).attr('height', height);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const times = pts.map((p) => p.time);

    const xScale = d3.scaleLinear()
      .domain([times[0], times[times.length - 1]])
      .range([0, innerW]);

    const yScale = d3.scaleLinear()
      .domain([-1, 1])
      .range([innerH, 0]);

    // ── Grid lines ────────────────────────────────────────────────────────────
    g.append('g')
      .selectAll('line')
      .data([-0.75, -0.5, -0.25, 0.25, 0.5, 0.75])
      .join('line')
      .attr('x1', 0).attr('x2', innerW)
      .attr('y1', (d) => yScale(d)).attr('y2', (d) => yScale(d))
      .attr('stroke', '#1E293B').attr('stroke-dasharray', '3,3');

    // ── Zero line ─────────────────────────────────────────────────────────────
    g.append('line')
      .attr('x1', 0).attr('x2', innerW)
      .attr('y1', yScale(0)).attr('y2', yScale(0))
      .attr('stroke', '#374151').attr('stroke-dasharray', '4,3');

    // ── Positive area (bids > asks) ────────────────────────────────────────
    const positiveArea = d3.area()
      .defined((p) => Number.isFinite(p.time) && Number.isFinite(p.value))
      .x((p) => xScale(p.time))
      .y0(yScale(0))
      .y1((p) => yScale(Math.max(0, p.value)))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(pts)
      .attr('d', positiveArea)
      .attr('fill', '#22C55E')
      .attr('opacity', 0.35);

    // ── Negative area (asks > bids) ────────────────────────────────────────
    const negativeArea = d3.area()
      .defined((p) => Number.isFinite(p.time) && Number.isFinite(p.value))
      .x((p) => xScale(p.time))
      .y0(yScale(0))
      .y1((p) => yScale(Math.min(0, p.value)))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(pts)
      .attr('d', negativeArea)
      .attr('fill', '#EF4444')
      .attr('opacity', 0.35);

    // ── EMA-10 smoothing line ─────────────────────────────────────────────
    const k   = 2 / (10 + 1);
    let ema   = pts[0].value;
    const emaPoints = pts.map((p) => {
      ema = p.value * k + ema * (1 - k);
      return { time: p.time, ema };
    });

    g.append('path')
      .datum(emaPoints)
      .attr('d',
        d3.line()
          .defined((p) => Number.isFinite(p.time) && Number.isFinite(p.ema))
          .x((p) => xScale(p.time))
          .y((p) => yScale(p.ema))
          .curve(d3.curveMonotoneX)
      )
      .attr('fill', 'none')
      .attr('stroke', '#FBBF24')
      .attr('stroke-width', 1.5)
      .attr('opacity', 0.9);
    // ── Current value annotation ───────────────────────────────────────────────────
    const lastPt    = pts[pts.length - 1];
    const lblColor  = lastPt.value >= 0 ? '#4ADE80' : '#F87171';
    g.append('text')
      .attr('x', innerW - 4).attr('y', 14)
      .attr('text-anchor', 'end')
      .attr('font-size', 11).attr('font-weight', '600')
      .attr('fill', lblColor)
      .text(`${lastPt.value >= 0 ? '+' : ''}${(lastPt.value * 100).toFixed(1)}%`);
    // ── Axes ──────────────────────────────────────────────────────────────────
    g.append('g')
      .attr('color', '#9CA3AF')
      .call(d3.axisLeft(yScale).ticks(5).tickSize(4).tickFormat(d3.format('+.0%')))
      .select('.domain').remove();

    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .attr('color', '#9CA3AF')
      .call(
        d3.axisBottom(xScale).ticks(5).tickSize(4)
          .tickFormat((t) => {
            const d = new Date(t);
            return `${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
          })
      )
      .select('.domain').remove();
  }, [imbalanceHistory, height]);

  useEffect(() => { render(); }, [render]);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(render);
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [render]);

  return (
    <Box ref={containerRef} sx={{ width: '100%' }}>
      <svg ref={svgRef} style={{ display: 'block' }} />
    </Box>
  );
}
