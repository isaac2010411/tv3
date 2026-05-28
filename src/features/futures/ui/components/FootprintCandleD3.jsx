import React, { useRef, useEffect, useCallback } from 'react';
import { Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import * as d3 from 'd3';
import { sanitizeFootprint } from '../../utils/marketDataGuards';

function fmtVol(v) {
  if (v == null) return '0';
  const n = Math.abs(v);
  if (n >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(v / 1_000).toFixed(1)}k`;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function intervalToMs(interval) {
  const m = /^(\d+)([smhdw])$/.exec(interval ?? '');
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  const units = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 };
  return n * (units[m[2]] ?? 0);
}

/**
 * Footprint Candle chart — shows buy/sell volume breakdown at each price level
 * within each candle.  The Point of Control (highest-volume level) is
 * highlighted with a border, and per-level delta is shown as a small label.
 *
 * Props:
 *   footprints  – array of FootprintDisplay objects (history + current)
 *   interval    – active interval string, e.g. '1m', '5m', '15m'
 *   height      – SVG height in px (default 380)
 */
export default function FootprintCandleD3({ footprints = [], interval = '', height = 380 }) {
  const svgRef       = useRef(null);
  const containerRef = useRef(null);
  const theme        = useTheme();

  const render = useCallback(() => {
    if (!svgRef.current || !containerRef.current) return;

    // Sanitize each footprint candle, dropping those with invalid levels
    const valid = footprints.map(sanitizeFootprint).filter(Boolean);
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    if (valid.length === 0) {
      const w = containerRef.current.clientWidth || 200;
      svg.attr('width', w).attr('height', height);
      svg.append('text')
        .attr('x', w / 2).attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', theme.palette.text.disabled)
        .style('font-size', '11px').text('Awaiting footprint data…');
      return;
    }

    const totalWidth = containerRef.current.clientWidth;
    // margin.right: enough for "104,567.89" at 9px Roboto Mono (~76px)
    // margin.bottom: two rows — time labels (row 1) + delta badges (row 2)
    const margin = { top: 8, right: 76, bottom: 40, left: 6 };
    const innerW = totalWidth - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    svg.attr('width', totalWidth).attr('height', height);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Fixed candle width so the chart always looks consistent regardless of
    // how many candles are available (avoids a single candle filling the whole width)
    const CANDLE_TARGET_W = 80;
    const maxCandles      = Math.max(1, Math.floor(innerW / CANDLE_TARGET_W));
    const visible         = valid.slice(-maxCandles);

    // Collect all price levels and candle highs for the Y domain
    let priceMin = Infinity;
    let priceMax = -Infinity;
    for (const fp of visible) {
      for (const lvl of fp.levels) {
        if (lvl.price < priceMin) priceMin = lvl.price;
        if (lvl.price > priceMax) priceMax = lvl.price;
      }
      if (fp.open != null && fp.open < priceMin) priceMin = fp.open;
      if (fp.high != null && fp.high > priceMax) priceMax = fp.high;
    }
    if (!isFinite(priceMin)) return;

    // ── Tick step & adaptive Y domain ─────────────────────────────────────────
    // Sort the first candle's levels to find the actual bucket/tick size.
    // This fixes the original bug where levels[0]/[1] could be non-adjacent.
    const firstFp  = visible.find((fp) => fp.levels.length > 1);
    let   tickStep = 0;
    if (firstFp && firstFp.levels.length > 1) {
      const sorted = [...firstFp.levels].sort((a, b) => a.price - b.price);
      tickStep = sorted[1].price - sorted[0].price;
    }

    // Pad is always relative to the actual price range — never an absolute value.
    // An absolute pad (e.g. 1 unit) would collapse DOGE at 0.10 into a flat line.
    const priceRangePad = (priceMax - priceMin) * 0.05;
    let yMin = priceMin - priceRangePad;
    let yMax = priceMax + priceRangePad;

    // If the natural cell height is too small to render (< MIN_CELL_PX), constrain
    // the Y domain to a readable window centred on the mid price.  This handles
    // instruments with very fine tick sizes (e.g. DOGE tick = 0.00001 USDT) where
    // showing the full price range would collapse every row to < 1 px.
    const MIN_CELL_PX = 8;
    if (tickStep > 0) {
      const naturalLevelH = innerH * tickStep / (yMax - yMin);
      if (naturalLevelH < MIN_CELL_PX) {
        const maxLevels = Math.floor(innerH / MIN_CELL_PX);
        const midPrice  = (priceMin + priceMax) / 2;
        const halfRange = (tickStep * maxLevels) / 2;
        yMin = midPrice - halfRange * 1.05;
        yMax = midPrice + halfRange * 1.05;
      }
    }

    const yScale = d3.scaleLinear()
      .domain([yMin, yMax])
      .range([innerH, 0]);

    const xScale = d3.scaleBand()
      .domain(visible.map((_, i) => i))
      .range([0, innerW])
      .padding(0.12);

    const candleW = xScale.bandwidth();

    // levelH: pixel height for one price bucket, derived from the (possibly
    // constrained) Y scale. Guaranteed >= 2 px so bars are always visible.
    const levelH = tickStep > 0
      ? Math.max(2, innerH * tickStep / (yMax - yMin))
      : 6;

    const maxLevelVol = d3.max(visible.flatMap((fp) => fp.levels.map((l) => l.total))) || 1;

    // Clip path: prevents per-level labels from bleeding into the Y axis gutter.
    // Coordinates are in the userSpaceOnUse of the referencing element (content group
    // inside g), so (0, 0) maps to the inner chart origin.
    svg.append('defs').append('clipPath')
      .attr('id', 'fp-candle-clip')
      .append('rect')
      .attr('x', 0).attr('y', 0)
      .attr('width', innerW).attr('height', innerH);

    // ── Grid lines ────────────────────────────────────────────────────────────
    g.append('g')
      .selectAll('line')
      .data(yScale.ticks(6))
      .join('line')
      .attr('x1', 0).attr('x2', innerW)
      .attr('y1', (d) => yScale(d)).attr('y2', (d) => yScale(d))
      .attr('stroke', theme.palette.divider)
      .attr('stroke-opacity', 0.35)
      .attr('stroke-dasharray', '3,3');

    // Clipped group for all candle content
    const content = g.append('g').attr('clip-path', 'url(#fp-candle-clip)');

    visible.forEach((fp, i) => {
      const cx = xScale(i);

      // Candle wick
      if (fp.high != null && fp.low != null) {
        content.append('line')
          .attr('x1', cx + candleW / 2).attr('x2', cx + candleW / 2)
          .attr('y1', yScale(fp.high)).attr('y2', yScale(fp.low))
          .attr('stroke', theme.palette.text.secondary)
          .attr('stroke-width', 1);
      }

      // Per-level bars
      for (const lvl of fp.levels) {
        const y      = yScale(lvl.price) - levelH / 2;
        const bh     = Math.max(1, levelH - 1);
        const barW   = (lvl.total / maxLevelVol) * candleW * 0.9;
        const buyW   = lvl.total > 0 ? (lvl.buyVol / lvl.total) * barW : 0;
        const sellW  = barW - buyW;

        // Buy bar (green, left portion)
        if (buyW > 0) {
          content.append('rect')
            .attr('x', cx)
            .attr('y', y)
            .attr('width', Math.max(0, buyW))
            .attr('height', bh)
            .attr('fill', theme.palette.success.main)
            .attr('opacity', 0.82);
        }

        // Sell bar (red, right portion)
        if (sellW > 0) {
          content.append('rect')
            .attr('x', cx + buyW)
            .attr('y', y)
            .attr('width', Math.max(0, sellW))
            .attr('height', bh)
            .attr('fill', theme.palette.error.main)
            .attr('opacity', 0.82);
        }

        // POC highlight
        if (lvl.isPoc) {
          content.append('rect')
            .attr('x', cx)
            .attr('y', y)
            .attr('width', candleW)
            .attr('height', bh)
            .attr('fill', 'none')
            .attr('stroke', theme.palette.warning.main)
            .attr('stroke-width', 1.5)
            .attr('rx', 1);
        }

        // Per-level volume labels: buy on left, sell on right
        if (levelH >= 8 && candleW >= 56) {
          content.append('text')
            .attr('x', cx + 2)
            .attr('y', y + levelH / 2 + 3)
            .attr('text-anchor', 'start')
            .attr('font-size', 9)
            .attr('font-family', 'Roboto Mono, monospace')
            .attr('fill', theme.palette.success.light)
            .text(fmtVol(lvl.buyVol));
          content.append('text')
            .attr('x', cx + candleW - 2)
            .attr('y', y + levelH / 2 + 3)
            .attr('text-anchor', 'end')
            .attr('font-size', 9)
            .attr('font-family', 'Roboto Mono, monospace')
            .attr('fill', theme.palette.error.light)
            .text(fmtVol(lvl.sellVol));
        } else if (candleW >= 28 && levelH >= 6 && Math.abs(lvl.delta) > 0) {
          // Fallback: compact delta centred
          content.append('text')
            .attr('x', cx + candleW / 2)
            .attr('y', y + levelH / 2 + 3)
            .attr('text-anchor', 'middle')
            .attr('font-size', 9)
            .attr('font-family', 'Roboto Mono, monospace')
            .attr('fill', lvl.delta >= 0 ? theme.palette.success.light : theme.palette.error.light)
            .text((lvl.delta >= 0 ? '+' : '') + fmtVol(lvl.delta));
        }
      }
    });

    // ── Bottom rows ───────────────────────────────────────────────────────────
    // Row 1 (y = innerH + 13): HH:MM time labels — every skipN candles
    // Row 2 (y = innerH + 27): per-candle total delta, rotated when candles are narrow
    const skipN = Math.max(1, Math.floor(visible.length / 6));

    visible.forEach((fp, i) => {
      const cx   = xScale(i);
      const midX = cx + candleW / 2;

      // Row 1: time label
      if (i % skipN === 0) {
        const d = new Date(fp.openTime);
        g.append('text')
          .attr('x', midX)
          .attr('y', innerH + 13)
          .attr('text-anchor', 'middle')
          .attr('font-size', 9)
          .attr('font-family', 'Roboto Mono, monospace')
          .attr('fill', theme.palette.text.secondary)
          .text(`${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`);
      }

      // Row 2: total delta badge — rotate at -45° when candles are narrow to avoid overlap
      const label      = (fp.totalDelta >= 0 ? '+' : '') + fmtVol(fp.totalDelta);
      const deltaColor = fp.totalDelta >= 0 ? theme.palette.success.light : theme.palette.error.light;
      if (candleW < 50) {
        g.append('text')
          .attr('transform', `translate(${midX},${innerH + 27}) rotate(-45)`)
          .attr('text-anchor', 'end')
          .attr('font-size', 9)
          .attr('font-weight', 600)
          .attr('font-family', 'Roboto Mono, monospace')
          .attr('fill', deltaColor)
          .text(label);
      } else {
        g.append('text')
          .attr('x', midX)
          .attr('y', innerH + 27)
          .attr('text-anchor', 'middle')
          .attr('font-size', 9)
          .attr('font-weight', 600)
          .attr('font-family', 'Roboto Mono, monospace')
          .attr('fill', deltaColor)
          .text(label);
      }

      // Countdown for the current (non-final) candle
      if (i === visible.length - 1 && !fp.isFinal) {
        const intervalMs = intervalToMs(interval);
        if (intervalMs > 0) {
          const remaining = Math.max(0, (fp.openTime + intervalMs) - Date.now());
          const totalSecs = Math.floor(remaining / 1000);
          const mm = String(Math.floor(totalSecs / 60)).padStart(2, '0');
          const ss = String(totalSecs % 60).padStart(2, '0');
          g.append('text')
            .attr('x', midX)
            .attr('y', -3)
            .attr('text-anchor', 'middle')
            .attr('font-size', 10)
            .attr('fill', theme.palette.text.disabled)
            .text(`${mm}:${ss}`);
        }
      }
    });

    // ── Y axis (price, right side) ────────────────────────────────────────────
    const yAxis = d3.axisRight(yScale)
      .ticks(6)
      .tickSize(3)
      .tickFormat(d3.format(',.2f'));

    g.append('g')
      .attr('transform', `translate(${innerW},0)`)
      .attr('color', theme.palette.text.secondary)
      .call(yAxis)
      .call((ax) => {
        ax.select('.domain').remove();
        ax.selectAll('line').attr('stroke', theme.palette.divider);
        ax.selectAll('text')
          .attr('font-size', 9)
          .attr('font-family', 'Roboto Mono, monospace');
      });

  }, [footprints, interval, height, theme]);

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
