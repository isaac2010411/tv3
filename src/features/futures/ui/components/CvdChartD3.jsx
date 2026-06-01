import React, { useRef, useEffect, useCallback } from 'react';
import { Box } from '@mui/material';
import * as d3 from 'd3';
import { sanitizeCvdHistory } from '../../utils/marketDataGuards';

/**
 * CVD Chart — Cumulative Volume Delta bars with the running CVD line overlay.
 *
 * Bars: each 1-second bucket, colored green (positive delta) or red (negative).
 * Line: the running CVD value across all bars (secondary right axis).
 *
 * Props:
 *   cvdHistory  – array of CvdPoint from useCvdData
 *   height      – SVG height in px (default 200)
 */
export default function CvdChartD3({ cvdHistory = [], height = 200 }) {
  const svgRef       = useRef(null);
  const containerRef = useRef(null);

  const render = useCallback(() => {
    if (!svgRef.current || !containerRef.current) return;

    const cleanHistory = sanitizeCvdHistory(cvdHistory);
    const totalWidth   = containerRef.current.clientWidth || 200;
    const svg          = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', totalWidth).attr('height', height);

    if (cleanHistory.length < 2) {
      svg.append('text')
        .attr('x', totalWidth / 2).attr('y', height / 2)
        .attr('text-anchor', 'middle').attr('fill', '#6B7280')
        .style('font-size', '11px').text('Awaiting CVD data…');
      return;
    }

    const margin = { top: 10, right: 55, bottom: 24, left: 55 };
    const innerW = Math.max(totalWidth - margin.left - margin.right, 1);
    const innerH = Math.max(height - margin.top - margin.bottom, 1);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const bars = cleanHistory
      .map((point) => ({
        time: Number(point.time),
        delta: Number(point.delta),
        close: Number(point.cvd),
      }))
      .filter((point) =>
        Number.isFinite(point.time) &&
        Number.isFinite(point.delta) &&
        Number.isFinite(point.close)
      );
    if (bars.length < 2) return;

    // ── Scales ────────────────────────────────────────────────────────────────
    const xScale = d3.scaleBand()
      .domain(bars.map((_, i) => i))
      .range([0, innerW])
      .padding(0.1);

    const deltaExt = d3.extent(bars, (b) => b.delta);
    const padD     = (Math.abs(deltaExt[1] - deltaExt[0]) * 0.15) || 1;
    const yDelta   = d3.scaleLinear()
      .domain([Math.min(deltaExt[0] - padD, 0), Math.max(deltaExt[1] + padD, 0)])
      .range([innerH, 0]);

    const cvdExt = d3.extent(bars, (b) => b.close);
    const padC   = (Math.abs(cvdExt[1] - cvdExt[0]) * 0.15) || 1;
    const yCvd   = d3.scaleLinear()
      .domain([cvdExt[0] - padC, cvdExt[1] + padC])
      .range([innerH, 0]);

    // ── Zero line ─────────────────────────────────────────────────────────────
    g.append('line')
      .attr('x1', 0).attr('x2', innerW)
      .attr('y1', yDelta(0)).attr('y2', yDelta(0))
      .attr('stroke', '#374151').attr('stroke-dasharray', '4,3');

    // ── Grid lines ─────────────────────────────────────────────────────────────
    g.append('g')
      .selectAll('line')
      .data(yDelta.ticks(4).filter((d) => d !== 0))
      .join('line')
      .attr('x1', 0).attr('x2', innerW)
      .attr('y1', (d) => yDelta(d)).attr('y2', (d) => yDelta(d))
      .attr('stroke', '#1E293B').attr('stroke-dasharray', '3,3');

    // ── Delta bars ────────────────────────────────────────────────────────────
    g.selectAll('.bar')
      .data(bars)
      .join('rect')
      .attr('x',      (_, i) => xScale(i))
      .attr('y',      (b) => b.delta >= 0 ? yDelta(b.delta) : yDelta(0))
      .attr('width',  xScale.bandwidth())
      .attr('height', (b) => Math.abs(yDelta(b.delta) - yDelta(0)))
      .attr('fill',   (b) => b.delta >= 0 ? '#22C55E' : '#EF4444')
      .attr('opacity', 0.75);

    // ── CVD line ──────────────────────────────────────────────────────────────
    const lineColor = (bars[bars.length - 1]?.close ?? 0) >= (bars[0]?.close ?? 0)
      ? '#60A5FA' : '#A78BFA';

    g.append('path')
      .datum(bars)
      .attr('d',
        d3.line()
          .defined((b) => Number.isFinite(b.close))
          .x((_, i) => xScale(i) + xScale.bandwidth() / 2)
          .y((b) => yCvd(b.close))
          .curve(d3.curveMonotoneX)
      )
      .attr('fill', 'none')
      .attr('stroke', lineColor)
      .attr('stroke-width', 1.5)
      .attr('opacity', 0.9);

    // ── Axes ──────────────────────────────────────────────────────────────────
    g.append('g')
      .attr('color', '#9CA3AF')
      .call(d3.axisLeft(yDelta).ticks(4).tickSize(4).tickFormat(d3.format('.2s')))
      .select('.domain').remove();

    g.append('g')
      .attr('transform', `translate(${innerW},0)`)
      .attr('color', '#60A5FA')
      .call(d3.axisRight(yCvd).ticks(4).tickSize(4).tickFormat(d3.format('.2s')))
      .select('.domain').remove();

    // X axis — time labels (sampled)
    const step = Math.max(1, Math.floor(bars.length / 5));
    const xAxisG = g.append('g').attr('transform', `translate(0,${innerH})`).attr('color', '#9CA3AF');
    bars.forEach((b, i) => {
      if (i % step !== 0) return;
      const d = new Date(b.time);
      xAxisG.append('text')
        .attr('x', xScale(i) + xScale.bandwidth() / 2)
        .attr('y', 14)
        .attr('text-anchor', 'middle')
        .attr('font-size', 9)
        .attr('fill', '#9CA3AF')
        .text(`${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`);
    });
  }, [cvdHistory, height]);

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
