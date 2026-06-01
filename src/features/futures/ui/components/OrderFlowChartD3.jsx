import React, { useRef, useEffect, useCallback } from 'react';
import { Box } from '@mui/material';
import * as d3 from 'd3';

const MARGIN = { top: 10, right: 55, bottom: 24, left: 60 };
const MAX_POINTS = 100;
const AXIS_REFRESH_MS = 500;

function buildPoints(trades) {
  const recent = [...trades].slice(0, MAX_POINTS).reverse();
  let delta = 0;
  return recent.flatMap((t) => {
    const vol = Number.parseFloat(t.quantity ?? t.qty ?? 0);
    const time = Number(t.time ?? t.timestamp ?? 0);
    if (!Number.isFinite(vol) || vol <= 0 || !Number.isFinite(time)) return [];
    const isBuy = t.isBuyerMaker === false;
    delta += isBuy ? vol : -vol;
    return { delta, isBuy, time };
  });
}

function styleAxis(axis, fontSize = '10px') {
  axis.select('.domain').attr('stroke', '#374151');
  axis.selectAll('.tick line').attr('stroke', '#374151');
  axis.selectAll('text').attr('fill', '#9CA3AF').style('font-size', fontSize);
}

function ensureChart(svg, innerH, margin) {
  let root = svg.select('g.of-root');
  if (root.empty()) {
    root = svg.append('g').attr('class', 'of-root');
    root.append('g').attr('class', 'of-grid');
    root.append('line').attr('class', 'of-zero').attr('stroke', '#374151').attr('stroke-dasharray', '4,3');
    root.append('path').attr('class', 'of-area').attr('opacity', 0.18);
    root.append('path').attr('class', 'of-line').attr('fill', 'none').attr('stroke-width', 1.5);
    root.append('g').attr('class', 'of-axis-x');
    root.append('g').attr('class', 'of-axis-y');
    root.append('text').attr('class', 'of-delta-label').attr('text-anchor', 'end').style('font-size', '11px').style('font-weight', '600');
  }

  root.attr('transform', `translate(${margin.left},${margin.top})`);
  root.select('g.of-axis-x').attr('transform', `translate(0,${innerH})`);
  return root;
}

/**
 * D3 order-flow chart: cumulative delta (buyer aggressors minus seller aggressors)
 * plotted over the last N recent trades.
 */
export default function OrderFlowChartD3({ trades = [], height = 180 }) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const rafRef = useRef(null);
  const widthRef = useRef(0);
  const lastAxisRenderRef = useRef(0);

  const render = useCallback((forceAxis = false) => {
    if (!svgRef.current || !containerRef.current || trades.length < 2) return;

    const totalWidth = containerRef.current.clientWidth;
    if (!totalWidth) return;

    const innerW = Math.max(totalWidth - MARGIN.left - MARGIN.right, 1);
    const innerH = Math.max(height - MARGIN.top - MARGIN.bottom, 1);
    const points = buildPoints(trades);
    if (points.length < 2) return;

    const svg = d3.select(svgRef.current);
    svg.attr('width', totalWidth).attr('height', height);

    const root = ensureChart(svg, innerH, MARGIN);
    const xScale = d3.scaleLinear().domain([0, points.length - 1]).range([0, innerW]);
    const yExt = d3.extent(points, (d) => d.delta);
    const yPad = (Math.abs((yExt[1] ?? 0) - (yExt[0] ?? 0)) * 0.1) || 1;
    const yScale = d3.scaleLinear()
      .domain([(yExt[0] ?? 0) - yPad, (yExt[1] ?? 0) + yPad])
      .range([innerH, 0]);

    const lastDelta = points[points.length - 1]?.delta ?? 0;
    const deltaColor = lastDelta >= 0 ? '#22C55E' : '#EF4444';

    const area = d3.area()
      .defined((d) => Number.isFinite(d.delta))
      .x((_, i) => xScale(i))
      .y0(yScale(0))
      .y1((d) => yScale(d.delta))
      .curve(d3.curveMonotoneX);

    const line = d3.line()
      .defined((d) => Number.isFinite(d.delta))
      .x((_, i) => xScale(i))
      .y((d) => yScale(d.delta))
      .curve(d3.curveMonotoneX);

    root.select('line.of-zero')
      .attr('x1', 0)
      .attr('x2', innerW)
      .attr('y1', yScale(0))
      .attr('y2', yScale(0));

    root.select('path.of-area')
      .datum(points)
      .attr('d', area)
      .attr('fill', deltaColor);

    root.select('path.of-line')
      .datum(points)
      .attr('d', line)
      .attr('stroke', deltaColor);

    root.select('text.of-delta-label')
      .attr('x', innerW)
      .attr('y', 10)
      .attr('fill', deltaColor)
      .text(`Δ ${lastDelta >= 0 ? '+' : ''}${lastDelta.toFixed(2)}`);

    const now = performance.now();
    const widthChanged = widthRef.current !== totalWidth;
    if (forceAxis || widthChanged || now - lastAxisRenderRef.current > AXIS_REFRESH_MS) {
      widthRef.current = totalWidth;
      lastAxisRenderRef.current = now;

      root.select('g.of-grid')
        .selectAll('line')
        .data(yScale.ticks(4).filter((d) => d !== 0), (d) => d)
        .join(
          (enter) => enter.append('line').attr('stroke', '#1E293B').attr('stroke-dasharray', '3,3'),
          (update) => update,
          (exit) => exit.remove(),
        )
        .attr('x1', 0)
        .attr('x2', innerW)
        .attr('y1', (d) => yScale(d))
        .attr('y2', (d) => yScale(d));

      root.select('g.of-axis-x')
        .call(
          d3.axisBottom(xScale)
            .tickValues([
              0,
              Math.floor(points.length * 0.25),
              Math.floor(points.length * 0.5),
              Math.floor(points.length * 0.75),
              points.length - 1,
            ])
            .tickFormat((i) => {
              const p = points[i];
              if (!p || !p.time) return '';
              const d = new Date(p.time);
              return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
            }),
        )
        .call((ax) => styleAxis(ax, '9px'));

      root.select('g.of-axis-y')
        .call(d3.axisLeft(yScale).ticks(4))
        .call((ax) => styleAxis(ax, '10px'));
    }
  }, [trades, height]);

  const scheduleRender = useCallback((forceAxis = false) => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      render(forceAxis);
    });
  }, [render]);

  useEffect(() => {
    scheduleRender(false);
    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [scheduleRender]);

  useEffect(() => {
    if (!containerRef.current) return undefined;
    const ro = new ResizeObserver(() => scheduleRender(true));
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [scheduleRender]);

  return (
    <Box ref={containerRef} sx={{ width: '100%' }}>
      <svg ref={svgRef} style={{ display: 'block' }} />
    </Box>
  );
}
