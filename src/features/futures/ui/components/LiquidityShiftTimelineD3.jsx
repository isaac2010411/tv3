import React, { useRef, useEffect, useCallback } from 'react';
import { Box, Typography } from '@mui/material';
import * as d3 from 'd3';

const SEVERITY_ALPHA = { HIGH: 0.9, MEDIUM: 0.6, LOW: 0.35 };
const TYPE_COLOR     = {
  LIQUIDITY_ADDED:   '#22C55E',
  LIQUIDITY_REMOVED: '#EF4444',
  WALL_ADDED:        '#60A5FA',
  WALL_REMOVED:      '#F97316',
};

/**
 * LiquidityShiftTimelineD3
 *
 * Vertical timeline of liquidity shift events: bars coloured by type with
 * intensity proportional to delta, fading as events age.
 *
 * Props:
 *   events  – array of liquidity shift events
 *             { type, side, delta, severity, timestamp, price? }
 *   height  – total height in px (default 200)
 *   maxAge  – how many ms of events to display (default 60_000 = 1 min)
 */
export default function LiquidityShiftTimelineD3({ events = [], height = 200, maxAge = 60_000 }) {
  const svgRef       = useRef(null);
  const containerRef = useRef(null);
  const renderRef    = useRef(null);

  const render = useCallback(() => {
    if (!svgRef.current || !containerRef.current) return;

    const totalWidth = containerRef.current.clientWidth || 200;
    const margin     = { top: 4, right: 8, bottom: 20, left: 8 };
    const innerW     = totalWidth - margin.left - margin.right;
    const innerH     = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', totalWidth).attr('height', height);

    if (events.length === 0) {
      svg.append('text')
        .attr('x', totalWidth / 2).attr('y', height / 2)
        .attr('text-anchor', 'middle').attr('fill', '#6B7280')
        .style('font-size', '11px')
        .text('No liquidity shifts detected');
      return;
    }

    const now = Date.now();
    // Keep only events within the time window
    const visible = events.filter((e) => (now - e.timestamp) <= maxAge);
    if (visible.length === 0) return;

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const timeExtent = [now - maxAge, now];
    const xScale     = d3.scaleLinear().domain(timeExtent).range([0, innerW]).clamp(true);

    const deltas    = visible.map((e) => Math.abs(parseFloat(e.delta ?? 0) || 0));
    const maxDelta  = d3.max(deltas) || 1;
    const barHeight = Math.max(4, Math.min(12, innerH / 3));

    // Group events by side into two tracks: BID (top half) and ASK (bottom half)
    const bidEvents = visible.filter((e) => e.side === 'BID' || e.side === 'bid');
    const askEvents = visible.filter((e) => e.side === 'ASK' || e.side === 'ask');

    const midY = innerH / 2;

    // Draw centre divider
    g.append('line')
      .attr('x1', 0).attr('x2', innerW)
      .attr('y1', midY).attr('y2', midY)
      .attr('stroke', '#1E293B').attr('stroke-dasharray', '3,3');

    const drawEvents = (evts, isAbove) => {
      evts.forEach((ev) => {
        const x      = xScale(ev.timestamp);
        const delta  = Math.abs(parseFloat(ev.delta ?? 0) || 0);
        const w      = Math.max(2, (delta / maxDelta) * 24);
        const color  = TYPE_COLOR[ev.type] ?? '#9CA3AF';
        const alpha  = SEVERITY_ALPHA[ev.severity] ?? 0.5;
        const ageFrac = Math.max(0, 1 - (now - ev.timestamp) / maxAge);
        const y      = isAbove ? midY - barHeight - 2 : midY + 2;

        g.append('rect')
          .attr('x', x - w / 2).attr('y', y)
          .attr('width', w).attr('height', barHeight)
          .attr('fill', color)
          .attr('opacity', alpha * ageFrac * 0.9 + 0.05)
          .attr('rx', 1);
      });
    };

    drawEvents(bidEvents, true);
    drawEvents(askEvents, false);

    // Labels
    g.append('text').attr('x', 2).attr('y', midY - barHeight - 4)
      .attr('fill', '#6B7280').style('font-size', '9px').text('BID');
    g.append('text').attr('x', 2).attr('y', midY + barHeight + 12)
      .attr('fill', '#6B7280').style('font-size', '9px').text('ASK');

    // Time axis
    const xAxis = d3.axisBottom(xScale).ticks(4)
      .tickFormat((ts) => {
        const d = new Date(ts);
        return `${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
      });
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .attr('color', '#6B7280')
      .call(xAxis)
      .call((ax) => ax.select('.domain').attr('stroke', '#374151'))
      .call((ax) => ax.selectAll('.tick line').attr('stroke', '#374151'))
      .call((ax) => ax.selectAll('text').style('font-size', '9px'));

  }, [events, height, maxAge]);

  // Keep renderRef current so the interval below always calls the latest render
  // without restarting the interval on every events change.
  useEffect(() => { renderRef.current = render; }, [render]);

  useEffect(() => { render(); }, [render]);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(() => renderRef.current?.());
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Re-render every second so fade animations progress. Uses a stable ref
  // callback so this interval is created once and never restarted.
  useEffect(() => {
    const id = setInterval(() => renderRef.current?.(), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <Box ref={containerRef} sx={{ width: '100%' }}>
      <svg ref={svgRef} style={{ display: 'block' }} />
    </Box>
  );
}
