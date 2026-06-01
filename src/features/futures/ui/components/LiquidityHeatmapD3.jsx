import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Box, Slider, Typography, ToggleButtonGroup, ToggleButton } from '@mui/material';
import * as d3 from 'd3';

const MODE_PCT = { tactical: 0.25, macro: 1.0 };

function levelPrice(level) {
  return Number(Array.isArray(level) ? level[0] : level?.price);
}

function levelQty(level) {
  return Number(Array.isArray(level) ? level[1] : level?.qty ?? level?.quantity);
}

export default function LiquidityHeatmapD3({
  snapshots = [],
  minutes = 5,
  onMinutesChange,
  height = 340,
  midPrice,
  mode: modeProp,
  onModeChange,
}) {
  const canvasRef = useRef(null);
  const svgRef = useRef(null);
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
    const canvas = canvasRef.current;
    const svgEl = svgRef.current;
    if (!container || !canvas || !svgEl || snapshots.length < 2) return;
    if (!Number.isFinite(Number(midPrice)) || Number(midPrice) <= 0) return;

    const totalWidth = container.clientWidth;
    const margin = { top: 6, right: 60, bottom: 24, left: 72 };
    const innerW = totalWidth - margin.left - margin.right;
    const innerH = height - 60 - margin.top - margin.bottom;

    canvas.width = totalWidth;
    canvas.height = height - 60;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const mid = Number(midPrice);
    const pct = MODE_PCT[mode] ?? 0.5;
    const priceMin = mid * (1 - pct / 100);
    const priceMax = mid * (1 + pct / 100);
    if (priceMin >= priceMax) return;

    const visibleCells = snapshots.flatMap((snap, timeIndex) => {
      const bids = (snap.bids ?? []).map((level) => ({
        timeIndex,
        price: levelPrice(level),
        bidVol: levelQty(level),
        askVol: 0,
      }));
      const asks = (snap.asks ?? []).map((level) => ({
        timeIndex,
        price: levelPrice(level),
        bidVol: 0,
        askVol: levelQty(level),
      }));
      return [...bids, ...asks];
    }).filter((cell) => (
      Number.isFinite(cell.price) &&
      cell.price >= priceMin &&
      cell.price <= priceMax
    ));
    if (visibleCells.length === 0) return;

    const nSnaps = snapshots.length;
    const maxVol = d3.max(visibleCells, (c) => Math.max(c.bidVol || 0, c.askVol || 0)) || 1;
    const xScale = d3.scaleLinear().domain([0, nSnaps - 1]).range([margin.left, margin.left + innerW]);
    const yScale = d3.scaleLinear().domain([priceMin, priceMax]).range([margin.top + innerH, margin.top]);
    const cellW = Math.max(1, innerW / nSnaps);
    const cellH = Math.max(1, innerH / 160);
    const bidColor = d3.scaleSequential(d3.interpolate('#091a0e', '#22C55E')).domain([0, maxVol]);
    const askColor = d3.scaleSequential(d3.interpolate('#1a0808', '#EF4444')).domain([0, maxVol]);

    for (const cell of visibleCells) {
      const x = xScale(cell.timeIndex);
      const y = yScale(cell.price);
      if (cell.bidVol > 0) {
        ctx.fillStyle = bidColor(cell.bidVol);
        ctx.fillRect(x, y, cellW, cellH);
      }
      if (cell.askVol > 0) {
        ctx.fillStyle = askColor(cell.askVol);
        ctx.fillRect(x, y, cellW, cellH);
      }
    }

    const midY = yScale(mid);
    ctx.save();
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(margin.left, midY);
    ctx.lineTo(margin.left + innerW, midY);
    ctx.stroke();
    ctx.restore();

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();
    svg.attr('width', totalWidth).attr('height', height - 60)
      .style('position', 'absolute').style('top', 0).style('left', 0)
      .style('pointer-events', 'none');

    const g = svg.append('g');
    const priceRange = priceMax - priceMin;
    const yStep = priceRange / 6;
    const yDecimals = yStep > 0 ? Math.max(0, Math.ceil(-Math.log10(yStep))) : 2;
    const yAxis = d3.axisRight(yScale).ticks(6).tickSize(4).tickFormat(d3.format(`,.${yDecimals}f`));
    g.append('g')
      .attr('transform', `translate(${margin.left + innerW},0)`)
      .attr('color', '#9CA3AF')
      .call(yAxis)
      .select('.domain').remove();

    const ticks = snapshots
      .map((s, i) => ({ i, t: s.timestamp }))
      .filter((_, i) => i % Math.max(1, Math.floor(nSnaps / 6)) === 0);
    const xAxis = d3.axisBottom(xScale)
      .tickValues(ticks.map((t) => t.i))
      .tickFormat((i) => {
        const snap = snapshots[i];
        if (!snap) return '';
        const d = new Date(snap.timestamp);
        return `${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
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
    if (!containerRef.current) return undefined;
    const ro = new ResizeObserver(render);
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [render]);

  return (
    <Box ref={containerRef} sx={{ position: 'relative', width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: 0.5, pb: 0.25 }}>
        <ToggleButtonGroup exclusive size="small" value={mode} onChange={handleMode}>
          <ToggleButton value="tactical" sx={{ fontSize: 9, py: 0.1, px: 0.75, lineHeight: 1.4 }}>Tactical +/-0.25%</ToggleButton>
          <ToggleButton value="macro" sx={{ fontSize: 9, py: 0.1, px: 0.75, lineHeight: 1.4 }}>Macro +/-1%</ToggleButton>
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
