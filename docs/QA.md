# Prototype verification

## Events filter clarification — 7 October 2026

- Replaced the generic inventory filter bar with activity period, product and date controls. Calendar year stays in the calendar; store/channel controls sit in the sales timeline. Unsupported carried inventory filters are cleared explicitly.
- Visible creator counts and sales totals update with selections. Browser examples: P003 has two recent creator records; store-channel sales total 403 units, then selecting Delhi gives 86. P001 in Delhi changes from two activity records and 81 sales units over 24 months to one activity record and seven units over seven days.
- Calendar year independently changes festival rows. Store/channel changes retain creator activity and calendar context. The activity period presets were exercised; custom date inputs remain available.
- TypeScript and production build passed. No page overflow at 375/768/1024/1440px; new desktop/mobile screenshots record the scoped controls.

## Demo coverage update — 7 October 2026

- Expanded deterministic fixtures to 7,471 sales, 15,953 movements and 38,070 normalized rows across the same 17 database-ready tables. Linked receipts and deductions preserve stock accounting; two intentionally inactive styles remain without recent sales.
- Every active product/applicable size/location combination has a sale in the shortest seven-day preset, including fully specified category, fabric, colour, craft and SKU filters. Each store has shortages, rotations, recent receipts, transit, matching-dupatta attachment and upward/downward trend scenarios.
- Dropdown choices count real matches under the other selected filters. Incompatible choices are disabled; no fallback rows ignore the user's scope. Replenishment counts inventory rather than recommendations alone so HO production candidates and inbound-only variants remain selectable.
- HO production candidates explicitly retain HO scope independent of store/channel selection. Attribute, search, size and stock-status filters still apply. Operational no-action tables, arbitrary unmatched searches, custom dates without sales and impossible catalogue combinations may legitimately be empty.
- Automated checks: 22 Vitest tests and 20 Python tests pass; TypeScript and production build pass. Normalized records, hashes, foreign keys, chronological non-negative balances and donor allocation remain validated.
- Browser: Delhi inventory, inactive stock, attention signals, rotation, replenishment, completed receipts, transit and matching-dupatta reports populated. Delhi + Stores + seven days + Suit sets + Chanderi + Pink + Embroidered + M returns five sales lines and populated attribute tables. This combination has no page overflow at 375/768/1024/1440px.
- Independent review found and resolved replenishment filters hiding HO and inbound-only variants. The new shared filter module is explicitly tracked despite the inherited `lib/` ignore rule.

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
