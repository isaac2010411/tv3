import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Box, ToggleButton, ToggleButtonGroup } from '@mui/material';
import * as d3 from 'd3';
import { sanitizeOrderBook } from '../../utils/marketDataGuards';

// Price range in % around mid for each mode
const MODE_RANGE = { tactical: 0.25, macro: 1.0 };

/**
 * D3 depth chart — cumulative bid (green) and ask (red) areas.
 *
 * Features:
 *   – Validates the top-of-book before rendering (never shows bad spread).
 *   – Price axis is clamped to ±pct% around mid (tactical 0.25%, macro 1%).
 *   – Hover tooltip shows price and cumulative quantity.
 *   – Displays spread (absolute + %) from book data.
 *
 * Props:
 *   orderBook  – backend-enriched order book
 *   height     – SVG height in px (default 200)
 *   markPrice  – optional mark price to overlay
 *   mode       – 'tactical' | 'macro' (controlled externally, optional)
 *   onModeChange – callback(mode)
 */
export default function DepthChartD3({ orderBook, height = 200, markPrice, mode: modeProp, onModeChange }) {
  const svgRef       = useRef(null);
  const tooltipRef   = useRef(null);
  const containerRef = useRef(null);
  const gradId       = useRef(`depth-${Math.random().toString(36).slice(2, 8)}`);
  const [internalMode, setInternalMode] = useState('tactical');
  const mode = modeProp ?? internalMode;

  const handleMode = (_, v) => {
    if (!v) return;
    setInternalMode(v);
    onModeChange?.(v);
  };

  const render = useCallback(() => {
    if (!svgRef.current || !containerRef.current) return;

    const book = sanitizeOrderBook(orderBook);
    const svg  = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    if (!book) {
      const totalWidth = containerRef.current.clientWidth || 200;
      svg.attr('width', totalWidth).attr('height', height);
      svg.append('text')
        .attr('x', totalWidth / 2).attr('y', height / 2)
        .attr('text-anchor', 'middle').attr('fill', '#6B7280')
        .style('font-size', '11px')
        .text('Awaiting valid order book…');
      return;
    }

    const { midPrice, spread, spreadPct, bestBid, bestAsk } = book;
    const pctRange = MODE_RANGE[mode] ?? 0.5;
    const lo       = midPrice * (1 - pctRange / 100);
    const hi       = midPrice * (1 + pctRange / 100);

    // ── Build cumulative depth arrays ────────────────────────────────────────
    // Bids come pre-sorted DESCENDING (best bid at index 0).
    // Accumulate from best bid outward, then reverse to get ascending price
    // order (low price → bestBid) so D3 can draw left-to-right correctly.
    const bidFiltered = book.bids.filter((l) =>
      Number.isFinite(l.price) &&
      Number.isFinite(l.quantity) &&
      l.price >= lo &&
      l.price <= hi
    );
    const bidCum = [];
    {
      let cum = 0;
      for (const l of bidFiltered) { cum += l.quantity; bidCum.push({ price: l.price, cum }); }
      bidCum.reverse(); // ascending: [lo_price … bestBid], cum high→low
    }

    // Asks come pre-sorted ASCENDING (best ask at index 0).
    // Accumulate left → right: bestAsk has lowest cumulative, edge has highest.
    const askFiltered = book.asks.filter((l) =>
      Number.isFinite(l.price) &&
      Number.isFinite(l.quantity) &&
      l.price >= lo &&
      l.price <= hi
    );
    const askCum = [];
    {
      let cum = 0;
      for (const l of askFiltered) { cum += l.quantity; askCum.push({ price: l.price, cum }); }
    }

    if (!bidCum.length || !askCum.length) return;

    const totalWidth = containerRef.current.clientWidth || 200;
    const margin     = { top: 10, right: 45, bottom: 28, left: 55 };
    const innerW     = Math.max(totalWidth - margin.left - margin.right, 1);
    const innerH     = Math.max(height - margin.top - margin.bottom, 1);

    svg.attr('width', totalWidth).attr('height', height);

    // ── Gradient defs ────────────────────────────────────────────────────────
    const gid  = gradId.current;
    const defs = svg.append('defs');

    // Bid: transparent on far left, solid green near bestBid (right side of bid area)
    const bidGrad = defs.append('linearGradient')
      .attr('id', `${gid}-bid`).attr('x1', '0%').attr('x2', '100%');
    bidGrad.append('stop').attr('offset', '0%').attr('stop-color', '#22C55E').attr('stop-opacity', 0.04);
    bidGrad.append('stop').attr('offset', '100%').attr('stop-color', '#22C55E').attr('stop-opacity', 0.38);

    // Ask: solid red near bestAsk (left side of ask area), transparent on far right
    const askGrad = defs.append('linearGradient')
      .attr('id', `${gid}-ask`).attr('x1', '0%').attr('x2', '100%');
    askGrad.append('stop').attr('offset', '0%').attr('stop-color', '#EF4444').attr('stop-opacity', 0.38);
    askGrad.append('stop').attr('offset', '100%').attr('stop-color', '#EF4444').attr('stop-opacity', 0.04);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const allCums = [...bidCum.map((d) => d.cum), ...askCum.map((d) => d.cum)];
    const xScale  = d3.scaleLinear().domain([lo, hi]).range([0, innerW]).clamp(true);
    const yScale  = d3.scaleLinear().domain([0, (d3.max(allCums) || 1) * 1.1]).range([innerH, 0]);
    const priceStep = (hi - lo) / 5;
    const decimals = priceStep > 0 ? Math.max(0, Math.ceil(-Math.log10(priceStep))) : 2;

    // ── Grid ─────────────────────────────────────────────────────────────────
    g.append('g').selectAll('line')
      .data(yScale.ticks(4)).join('line')
      .attr('x1', 0).attr('x2', innerW)
      .attr('y1', (d) => yScale(d)).attr('y2', (d) => yScale(d))
      .attr('stroke', '#1E293B').attr('stroke-dasharray', '3,3');

    // ── Spread highlight zone ─────────────────────────────────────────────────
    const bx = xScale(bestBid);
    const ax = xScale(bestAsk);
    if (ax > bx) {
      g.append('rect')
        .attr('x', bx).attr('width', Math.max(ax - bx, 1))
        .attr('y', 0).attr('height', innerH)
        .attr('fill', '#F59E0B').attr('opacity', 0.07);
    }

    // ── Bid area & line ───────────────────────────────────────────────────────
    // curveStepBefore: vertical step drawn BEFORE each data point → correct
    // staircase shape where each price level's full qty is visible
    g.append('path').datum(bidCum)
      .attr('d', d3.area().defined((d) => Number.isFinite(d.price) && Number.isFinite(d.cum)).x((d) => xScale(d.price)).y0(innerH).y1((d) => yScale(d.cum)).curve(d3.curveStepBefore))
      .attr('fill', `url(#${gid}-bid)`);
    g.append('path').datum(bidCum)
      .attr('d', d3.line().defined((d) => Number.isFinite(d.price) && Number.isFinite(d.cum)).x((d) => xScale(d.price)).y((d) => yScale(d.cum)).curve(d3.curveStepBefore))
      .attr('fill', 'none').attr('stroke', '#22C55E').attr('stroke-width', 1.5);

    // ── Ask area & line ───────────────────────────────────────────────────────
    g.append('path').datum(askCum)
      .attr('d', d3.area().defined((d) => Number.isFinite(d.price) && Number.isFinite(d.cum)).x((d) => xScale(d.price)).y0(innerH).y1((d) => yScale(d.cum)).curve(d3.curveStepAfter))
      .attr('fill', `url(#${gid}-ask)`);
    g.append('path').datum(askCum)
      .attr('d', d3.line().defined((d) => Number.isFinite(d.price) && Number.isFinite(d.cum)).x((d) => xScale(d.price)).y((d) => yScale(d.cum)).curve(d3.curveStepAfter))
      .attr('fill', 'none').attr('stroke', '#EF4444').attr('stroke-width', 1.5);

    // ── Best bid / ask markers ────────────────────────────────────────────────
    [[bestBid, '#22C55E', 'B'], [bestAsk, '#EF4444', 'A']].forEach(([px, clr, lbl]) => {
      const x = xScale(px);
      g.append('line').attr('x1', x).attr('x2', x).attr('y1', 0).attr('y2', innerH)
        .attr('stroke', clr).attr('stroke-dasharray', '2,3').attr('stroke-width', 1).attr('opacity', 0.7);
      g.append('text').attr('x', x + 2).attr('y', innerH - 6).attr('fill', clr)
        .style('font-size', '9px').text(lbl);
    });

    // ── Mid-price line ────────────────────────────────────────────────────────
    const midX = xScale(midPrice);
    g.append('line').attr('x1', midX).attr('x2', midX).attr('y1', 0).attr('y2', innerH)
      .attr('stroke', '#F59E0B').attr('stroke-dasharray', '4,3').attr('stroke-width', 1);
    g.append('text').attr('x', midX + 4).attr('y', 13)
      .attr('fill', '#F59E0B').style('font-size', '10px')
      .text(`Mid ${midPrice.toFixed(decimals)}`);
    g.append('text').attr('x', midX + 4).attr('y', 24)
      .attr('fill', '#9CA3AF').style('font-size', '9px')
      .text(`Spr ${spread.toFixed(decimals)} (${spreadPct.toFixed(3)}%)`);

    // ── Mark price line ───────────────────────────────────────────────────────
    const mp = markPrice != null ? Number(markPrice) : null;
    if (mp && !isNaN(mp) && mp >= lo && mp <= hi) {
      const mpX = xScale(mp);
      g.append('line').attr('x1', mpX).attr('x2', mpX).attr('y1', 0).attr('y2', innerH)
        .attr('stroke', '#A78BFA').attr('stroke-dasharray', '5,3').attr('stroke-width', 1.2);
      g.append('text').attr('x', mpX + 4).attr('y', 35)
        .attr('fill', '#A78BFA').style('font-size', '9px').text(`Mark ${mp.toFixed(decimals)}`);
    }

    // ── Axes ──────────────────────────────────────────────────────────────────
    g.append('g').attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(xScale).ticks(5).tickFormat(d3.format(`,.${decimals}f`)))
      .call((ax) => ax.select('.domain').attr('stroke', '#374151'))
      .call((ax) => ax.selectAll('.tick line').attr('stroke', '#374151'))
      .call((ax) => ax.selectAll('text').attr('fill', '#9CA3AF').style('font-size', '9px'));
    g.append('g')
      .call(d3.axisLeft(yScale).ticks(4))
      .call((ax) => ax.select('.domain').attr('stroke', '#374151'))
      .call((ax) => ax.selectAll('.tick line').attr('stroke', '#374151'))
      .call((ax) => ax.selectAll('text').attr('fill', '#9CA3AF').style('font-size', '9px'));

    // ── Hover overlay ─────────────────────────────────────────────────────────
    const bisect = d3.bisector((d) => d.price).left;
    const tooltip = d3.select(tooltipRef.current);

    const overlay = g.append('rect')
      .attr('width', innerW).attr('height', innerH)
      .attr('fill', 'transparent').style('cursor', 'crosshair');

    overlay.on('mousemove', function (event) {
      const [mx] = d3.pointer(event);
      const px   = xScale.invert(mx);

      const bidIdx = bisect(bidCum, px, 0, bidCum.length - 1);
      const askIdx = bisect(askCum, px, 0, askCum.length - 1);
      const bidPt  = bidCum[bidIdx];
      const askPt  = askCum[askIdx];
      const pt     = (bidPt && px <= midPrice) ? bidPt : askPt;
      if (!pt) return;

      const side = px <= midPrice ? 'Bid' : 'Ask';
      const clr  = px <= midPrice ? '#22C55E' : '#EF4444';

      tooltip
        .style('display', 'block')
        .style('left',  (margin.left + xScale(pt.price) + 10) + 'px')
        .style('top',   (margin.top  + yScale(pt.cum)   - 20) + 'px')
        .style('color', clr)
        .html(`<b>${side}</b> ${pt.price.toFixed(2)}<br/>Cum: ${pt.cum.toFixed(4)}`);
    }).on('mouseleave', () => tooltip.style('display', 'none'));

  }, [orderBook, height, mode, markPrice]);

  useEffect(() => { render(); }, [render]);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(() => render());
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [render]);

  return (
    <Box ref={containerRef} sx={{ width: '100%', position: 'relative' }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', px: 0.5, pb: 0.25, gap: 1 }}>
        <ToggleButtonGroup exclusive size="small" value={mode} onChange={handleMode}>
          <ToggleButton value="tactical" sx={{ fontSize: 9, py: 0.1, px: 0.75, lineHeight: 1.4 }}>Tactical</ToggleButton>
          <ToggleButton value="macro"    sx={{ fontSize: 9, py: 0.1, px: 0.75, lineHeight: 1.4 }}>Macro</ToggleButton>
        </ToggleButtonGroup>
      </Box>
      <svg ref={svgRef} style={{ display: 'block' }} />
      {/* Tooltip overlay */}
      <Box
        ref={tooltipRef}
        sx={{
          display: 'none', position: 'absolute', pointerEvents: 'none',
          bgcolor: 'rgba(15,23,42,0.92)', border: '1px solid #334155',
          borderRadius: 1, px: 0.75, py: 0.5, fontSize: 10, lineHeight: 1.5,
          whiteSpace: 'nowrap', zIndex: 10,
        }}
      />
    </Box>
  );
}
