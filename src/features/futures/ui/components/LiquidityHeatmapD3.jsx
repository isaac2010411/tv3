import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Box, Slider, Typography, ToggleButtonGroup, ToggleButton } from '@mui/material';
import * as d3 from 'd3';
import { buildHeatmapCells } from '../../domain/heatmap.model';

// Visible price range in % around mid for each mode
const MODE_PCT = { tactical: 0.25, macro: 1.0 };

/**
 * Bookmap-style liquidity heatmap.
 *
 * Improvements:
 *   – Price axis is clamped to ±pct% around mid price (no more full-range compression).
 *   – Mode selector: tactical (±0.25%) or macro (±1%).
 *   – Mid price line overlaid on the canvas.
 *   – Falls back gracefully when midPrice is unavailable.
 *
 * Props:
 *   snapshots        – rolling array of orderbook snapshots { bids, asks, timestamp }
 *   minutes          – how many minutes of history to display
 *   onMinutesChange  – callback(n: number)
 *   height           – total component height in px (default 340)
 *   midPrice         – current mid price (used to centre the visible range)
 *   mode             – 'tactical' | 'macro' (controlled, optional)
 *   onModeChange     – callback(mode)
 */
export default function LiquidityHeatmapD3({
  snapshots = [],
  minutes   = 5,
  onMinutesChange,
  height    = 340,
  midPrice,
  mode: modeProp,
  onModeChange,
}) {
  const canvasRef    = useRef(null);
  const svgRef       = useRef(null);
  const containerRef = useRef(null);
  const [internalMode, setInternalMode] = useState('tactical');
  const mode = modeProp ?? internalMode;

  const handleMode = (_, v) => {
    if (!v) return;
    setInternalMode(v);
    onModeChange?.(v);
  };

  const render = useCallback(() => {
    const container = containerRef.current;
    const canvas    = canvasRef.current;
    const svgEl     = svgRef.current;
    if (!container || !canvas || !svgEl || snapshots.length < 2) return;

    const totalWidth = container.clientWidth;
    const margin     = { top: 6, right: 60, bottom: 24, left: 72 };
    const innerW     = totalWidth - margin.left - margin.right;
    const innerH     = height - 60 - margin.top - margin.bottom;

    canvas.width  = totalWidth;
    canvas.height = height - 60;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // ── Determine price range ─────────────────────────────────────────────────
    // Prefer midPrice-based range; fall back to full range if midPrice unavailable
    let priceMin, priceMax;
    if (midPrice && Number.isFinite(midPrice) && midPrice > 0) {
      const pct  = MODE_PCT[mode] ?? 0.5;
      priceMin   = midPrice * (1 - pct / 100);
      priceMax   = midPrice * (1 + pct / 100);
    } else {
      // Fall back: compute range from all snapshots
      let min = Infinity, max = -Infinity;
      for (const snap of snapshots) {
        for (const l of [...(snap.bids ?? []), ...(snap.asks ?? [])]) {
          const p = parseFloat(Array.isArray(l) ? l[0] : l.price);
          if (Number.isFinite(p) && p > 0) { if (p < min) min = p; if (p > max) max = p; }
        }
      }
      if (!Number.isFinite(min) || min === max) return;
      const pad = (max - min) * 0.002;
      priceMin = min - pad;
      priceMax = max + pad;
    }
    if (priceMin >= priceMax) return;

    const priceRange = priceMax - priceMin;
    const bucketSize = Math.pow(10, Math.floor(Math.log10(priceRange / 100)));

    const cells = buildHeatmapCells(snapshots, bucketSize);
    if (cells.length === 0) return;

    // Filter cells to visible price range
    const visibleCells = cells.filter((c) => c.price >= priceMin && c.price + bucketSize <= priceMax);
    if (visibleCells.length === 0) return;

    const maxVol  = d3.max(visibleCells, (c) => c.totalVol) || 1;
    const nSnaps  = snapshots.length;

    const xScale = d3.scaleLinear().domain([0, nSnaps - 1]).range([margin.left, margin.left + innerW]);
    const yScale = d3.scaleLinear().domain([priceMin, priceMax]).range([margin.top + innerH, margin.top]);

    const cellW = Math.max(1, innerW / nSnaps);
    const cellH = Math.max(1, innerH / ((priceMax - priceMin) / bucketSize));

    const bidColor = d3.scaleSequential(d3.interpolate('#091a0e', '#22C55E')).domain([0, maxVol]);
    const askColor = d3.scaleSequential(d3.interpolate('#1a0808', '#EF4444')).domain([0, maxVol]);

    for (const cell of visibleCells) {
      const x = xScale(cell.timeIndex);
      const y = yScale(cell.price + bucketSize);

      if (cell.bidVol > 0) {
        ctx.fillStyle = bidColor(cell.bidVol);
        ctx.fillRect(x, y, cellW, cellH);
      }
      if (cell.askVol > 0) {
        ctx.fillStyle = askColor(cell.askVol);
        ctx.fillRect(x, y, cellW, cellH);
      }
    }

    // ── Mid-price line on canvas ──────────────────────────────────────────────
    if (midPrice && Number.isFinite(midPrice) && midPrice >= priceMin && midPrice <= priceMax) {
      const midY = yScale(midPrice);
      ctx.save();
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(margin.left, midY);
      ctx.lineTo(margin.left + innerW, midY);
      ctx.stroke();
      ctx.restore();
    }

    // ── SVG axes overlay ────────────────────────────────────────────────────
    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();
    svg.attr('width', totalWidth).attr('height', height - 60)
       .style('position', 'absolute').style('top', 0).style('left', 0)
       .style('pointer-events', 'none');

    const g = svg.append('g');

    // Y axis (price)
    const yStep = priceRange / 6;
    const yDecimals = yStep > 0 ? Math.max(0, Math.ceil(-Math.log10(yStep))) : 2;
    const yAxis = d3.axisRight(yScale).ticks(6).tickSize(4).tickFormat(d3.format(`,.${yDecimals}f`));
    g.append('g')
      .attr('transform', `translate(${margin.left + innerW},0)`)
      .attr('color', '#9CA3AF')
      .call(yAxis)
      .select('.domain').remove();

    // X axis (time)
    const ticks = snapshots
      .map((s, i) => ({ i, t: s.timestamp }))
      .filter((_, i) => i % Math.max(1, Math.floor(nSnaps / 6)) === 0);
    const xAxis = d3.axisBottom(xScale)
      .tickValues(ticks.map((t) => t.i))
      .tickFormat((i) => {
        const snap = snapshots[i];
        if (!snap) return '';
        const d = new Date(snap.timestamp);
        return `${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
      })
      .tickSize(4);

    g.append('g')
      .attr('transform', `translate(0,${margin.top + innerH})`)
      .attr('color', '#9CA3AF')
      .call(xAxis)
      .select('.domain').remove();

  }, [snapshots, height, midPrice, mode]);

  useEffect(() => { render(); }, [render]);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(render);
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [render]);

  return (
    <Box ref={containerRef} sx={{ position: 'relative', width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: 0.5, pb: 0.25 }}>
        <ToggleButtonGroup exclusive size="small" value={mode} onChange={handleMode}>
          <ToggleButton value="tactical" sx={{ fontSize: 9, py: 0.1, px: 0.75, lineHeight: 1.4 }}>Tactical ±0.25%</ToggleButton>
          <ToggleButton value="macro"    sx={{ fontSize: 9, py: 0.1, px: 0.75, lineHeight: 1.4 }}>Macro ±1%</ToggleButton>
        </ToggleButtonGroup>
      </Box>
      <Box sx={{ position: 'relative', height: height - 60 }}>
        <canvas ref={canvasRef} style={{ display: 'block' }} />
        <svg ref={svgRef} />
      </Box>
      <Box sx={{ px: 3, pt: 0.5 }}>
        <Typography variant="caption" color="text.secondary">
          History: {minutes} min
        </Typography>
        <Slider
          size="small"
          min={1}
          max={15}
          step={1}
          value={minutes}
          onChange={(_, v) => onMinutesChange?.(v)}
          marks={[{ value: 1, label: '1m' }, { value: 5, label: '5m' }, { value: 10, label: '10m' }, { value: 15, label: '15m' }]}
          sx={{ mt: 0.5 }}
        />
      </Box>
    </Box>
  );
}
