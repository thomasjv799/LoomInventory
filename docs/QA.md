# Prototype verification

The frontend uses simulated business data. Image references were observed on public catalogue pages; festival dates have per-record source links. No stock operations or backend integrations are implemented.

## Automated checks

- Movement balances reconcile with opening inventory. Chronological balances are non-negative, with openings applied before same-day movements.
- Sales map to exactly one negative movement. Sales prices come only from transaction net values.
- Transit equals dispatched minus received and never contributes to destination availability before receipt.
- Dispatch center stock, quarantine and reservations are unavailable.
- Replenishment uses shared source pools once and protects HO ecommerce as well as store donor cover.
- Product/month forecasts reconcile with their size allocations.
- Image manifest has 30 public references; missing images use a stable labelled fallback.
- Search supports product and variant SKUs; classification filters respect local settings.
- Formula-like values and CSV delimiters are escaped for export.

## Planning assumptions

Rates use the last 28 complete days, adjusted for a daily closing-stock exposure proxy. This does not recover intraday stockouts or unmet demand. Suggested quantities include three assumed days of transfer lead time plus configured cover, less availability and timely inbound units. Historical receipts display actual fixture transit times. Suggestions remain review-only.

Forecasts are precomputed network demand for November 2026 through January 2027. Calendar-day baseline × simulated season factor is apportioned by observed size sales using largest remainder. Zero observed demand is insufficient evidence, not proof of zero future demand. Changing location, channel, historical period or settings does not retrain a forecast. A size filter selects existing size allocations.

Healthy options require every configured core size. Hit/Average/Miss uses 30-day unit sell-through against eligible opening stock and receipts, and requires 14 observed in-stock days. Fresh stock refers to available units of current-season styles launched within the configured window.

The older portion of history is sampled every 28 days; the most recent 90 days have daily sales generation. Calendar reference dates are distinct from simulated shopping windows. Creator records are fictional; associations do not establish causation.

## Independent review

Addressed findings: variant SKU matching across reports; launch-date coherence; HO donor demand protection; same-date opening test ordering; 2024/2025 event history. Browser review additionally identified and corrected rapid filter updates losing prior context and drawer opener remounts affecting focus restoration.

## Final verification results

- `npm test`: **17 passed**.
- `npm run check:data`: **9 passed**; 30 products, 150 variants, 4,975 sales and 6,778 movements generated deterministically.
- `npm run typecheck`: passed.
- `npm run build`: passed; statically prerendered shell with local asynchronous fixture loading.
- Independent source recheck: no remaining important defects; all five earlier findings resolved.
- Browser: all eight views checked at 375, 768, 1024 and 1440px. Document width equalled viewport width on every view; wide tables scroll inside their containers.
- All 30 catalogue primary images loaded successfully across four matrix pages. Fallback is retained for future remote-image failures; secondary references are deliberately null when unverified.
- Store plus variant-SKU filtering retained both URL parameters on consecutive edits. Matrix switching, pagination and chart data alternatives worked.
- Product and recommendation drawers restored focus to their initiating table buttons after closure. Keyboard Tab focus displayed a 2px bronze outline. Reduced-motion rules remove transitions and animations; chart animation is disabled.
- Settings persistence verified by changing cover to 21 and enabling peak mode, refreshing, then resetting to defaults.
- CSV button exercised and CSV escaping validated automatically. Forecast-specific CSV is available separately.
- Text contrast: ink/white 15.68:1, muted/white 5.07:1, bronze/white 4.80:1, muted/ivory 4.65:1. Green, red and amber status text/background pairs exceed 4.9:1 and include words/icons.

This is a manual accessibility review plus semantic checks, not a formal assistive-technology certification. Backend, imports, durable operations and forecasting validation remain later milestones.

## Documentation and backend-handoff update — 6 October 2026

- Promotional page headings replaced with section names and one short explanation; redundant page eyebrow removed. Representative report titles changed to direct labels.
- Added dashboard, metrics, code architecture, data/import, database, API and backend-roadmap guides with a linked index.
- Exported 17 normalized tables and 19,708 rows, with checksums, load order, field contracts and portable/PostgreSQL reference DDL. No hosted database changes.
- Qualified reused mock bill references into consistent date/location/channel order headers while preserving original references and sales values.
- OpenAPI 3.1 design contains 22 paths and 25 proposed operations. Validated with openapi-spec-validator 0.9.0; backend behavior is not implemented.
- Latest checks: 17 Vitest tests and 20 Python tests pass (37 total); TypeScript and production build pass. Eleven of the Python tests specifically cover the normalized/API handoff.
- Independent review findings about omitted composite-FK metadata and integer API booleans resolved and rechecked. No remaining findings from that review.
- All eight views checked again at 375/768/1024/1440px; document width matches viewport width. Updated all fourteen screenshots. Product/rationale drawers and mobile navigation exercised; mobile navigation returns focus to its opener.
- PostgreSQL draft execution and actual FastAPI authorization/concurrency tests remain next-phase gates. SQLite validation is not represented as PostgreSQL deployment validation.
