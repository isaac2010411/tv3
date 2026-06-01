# Domain Calculations Backend Migration

`tv1` is the source of truth for market, trading, risk, signal and aggregate calculations. `tv3` should keep only display formatting, layout, D3 geometry and temporary compatibility fallbacks.

| Current tv3 calculation | Target owner | Status |
| --- | --- | --- |
| Order book sorting, top of book, spread, mid price | backend-domain | `tv1` emits `bookMetrics` on `futures:book:local` and `futures:book:metrics`; tv3 keeps fallback processors temporarily. |
| Order book imbalance, bid/ask top volume, tactical walls | backend-domain | `OrderBookMetrics` in `tv1`; `ScalpingDecisionRibbon` prefers `decisionTape`/`bookMetrics`. |
| Heatmap snapshot trimming | backend-domain + frontend-display window | `tv1` emits reduced `heatmapSnapshot`; `tv3` only keeps bounded UI history for the selected minutes. |
| CVD point normalization and buckets | backend-domain | `CvdService` emits normalized `point` and bucket payloads; tv3 still stores history for charts. |
| Footprint level totals, delta, imbalance, POC | backend-domain | `FootprintCandle.toPlainObject()` emits display-ready level fields. |
| EMA20, EMA50, RSI14, MACD | backend-domain | `tv1` emits `futures:market:indicators` and embeds `indicators` on candle updates; tv3 chart falls back while historical candles are not enriched. |
| Decision tape delta, wall choice, spread state, bias | backend-domain | `tv1` emits `futures:decision:tape`; tv3 renders received values with fallback during rollout. |
| Tape side, notional, size class | backend-domain | `tv1` enriches `futures:trade:agg`; tv3 may still filter by user-selected min notional. |
| Order validation rules, tick/step/notional/risk | backend-domain | `tv3` local validation is reduced to empty/positive field checks; server remains authoritative. |
| Portfolio and paper account stats | backend-domain | `tv1` snapshot includes `liveSummary` and `paperSummary`; tv3 prefers those fields. |
| Number/date formatting and D3 scales | frontend-display | Remains in tv3. |

Rollout rule: new backend fields must be additive. Remove tv3 compatibility fallbacks only after the matching `tv1` contract is deployed and covered by tests.
