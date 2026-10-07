# Frontend and data architecture

## Current runtime

```mermaid
flowchart LR
    G[Deterministic Python generator] --> F[data/mock-data.json]
    F --> P[public/mock-data.json]
    F --> E[Relational seed exporter]
    E --> J[Normalized JSONL + contracts]
    J --> V[SQLite reconciliation checks]
    P --> A[Async fixture provider]
    A --> C[Shared analytics]
    C --> D[Dashboard sections]
    U[URL filters + local settings] --> C
    D --> X[Drawers, charts and CSV]
```

Next.js serves a static application shell and the public fixture. The interactive dashboard is a client component. No API server, authentication service, backend database or environment secret is required. The provider caches its loading promise, retries after failure by clearing that cache, and returns typed Dataset objects. TypeScript types are compile-time guarantees; the browser does not perform comprehensive runtime fixture validation. Offline generation tests provide that assurance for committed fixtures.

## File map

| Path                            | Responsibility                                                                                                                            |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| app/layout.tsx                  | Root metadata and global styles                                                                                                           |
| app/page.tsx                    | Dashboard entry with Suspense boundary                                                                                                    |
| app/globals.css                 | Design tokens, component layout, responsive rules and focus/reduced-motion behavior                                                       |
| components/dashboard.tsx        | Eight sections, URL filters, report assembly, local settings, drawer state and export selection                                           |
| components/data-table.tsx       | TanStack sorting/pagination, scroll-contained table wrapper and accessible controls                                                       |
| components/charts.tsx           | Recharts visualization and accessible data-table alternative                                                                              |
| components/product-image.tsx    | Next Image display, stable dimensions and missing-source fallback                                                                         |
| components/ui/                  | Shared Button and Radix Dialog primitives                                                                                                 |
| lib/types.ts                    | Product, variant, ledger, sales, transfer, event, filter, settings and report interfaces                                                  |
| lib/provider.ts                 | Asynchronous fixture access seam                                                                                                          |
| lib/filter-options.ts           | Counts compatible catalogue/location choices from real report records; disables incompatible dropdown options                             |
| lib/analytics.ts                | Inventory reconstruction, filtering, recommendations, option health, trends, price bands, attributes, dupatta allocation and CSV escaping |
| scripts/generate_mock.py        | Canonical fixture generation and eleven logical input projections                                                                         |
| scripts/export_database_seed.py | Normalization, relational DDL and reconciliation                                                                                          |
| scripts/build_api_contract.py   | Proposed OpenAPI document generation                                                                                                      |
| tests/                          | Analytics, fixture integrity and backend-handoff contract checks                                                                          |
| docs/                           | Guides, assumptions, API/SQL drafts and screenshots                                                                                       |

The original repository used a Python-oriented ignore template, including `lib/`. That rule has been removed so the shared TypeScript provider, types, analytics and filter modules are included in Git. Always inspect the staged file list before pushing.

## State and interactions

Navigation chooses a section through `view` in URL parameters. Report filters merge with current parameters using native history updates, which Next's search-parameter hook observes. This avoids losing earlier filter changes during rapid consecutive edits. Browser navigation restores URL context. Table sort/page state remains local to its table.

Settings are browser-local for the prototype. Validation/reset and report recomputation use the shared defaults. Inventory rows are cached by Dataset identity; settings-dependent classifications are recomputed separately. Recommendations derive a shared allocation plan before display filtering, so changing pages cannot create additional donor stock.

Radix dialogs handle focus trapping and Escape. The dashboard remembers initiating elements, including a fallback when table cells remount, so focus restoration remains usable. On narrow screens a dialog replaces sidebar navigation; tables have their own horizontal scroll areas. Remote images preserve portrait presentation and a fallback. Reduced-motion rules suppress transitions; chart animation is disabled.

CSV converts the current primary report's complete filtered rows. Quoting and formula-prefix protection happen in shared analytics. Browser-generated exports are demo artifacts; a backend export must apply server-side authorization independently of the UI.

## Build and dependencies

The committed lockfile records the working package versions. Next.js/React/TypeScript, Tailwind, Lucide, Radix, TanStack Table, Recharts and CVA support the frontend. The interface uses both Tailwind setup and explicit global component CSS. Newsreader/Roboto are referenced in CSS; font/image loading can depend on network access, while fixture data is served locally.

`npm run build` uses Webpack because the development host restricted Turbopack worker binding. The repository includes optional Darwin ARM64 native packages for this host; npm skips incompatible optional packages on other platforms. Verify `npm ci` and the production build on the deployment platform before launch.

## Test boundaries

- TypeScript checks frontend model usage and component compilation.
- Vitest tests meaningful report invariants: no double allocation, price-source semantics, filters, stock exclusions and CSV handling.
- Python tests reconcile the source ledger and transfers, temporal stock validity and generated fixtures.
- Handoff tests import the normalized package into SQLite with constraints enabled, check tenant-scoped FKs, order consistency, hashes, forecasts, document links and OpenAPI references.
- A separate OpenAPI-spec-validator check validates the proposed document against OpenAPI 3.1.
- Browser screenshots and interaction review cover layout, titles, controls and representative drawers. They are not a certification of assistive technology support.

## Next-phase refactoring

The eight-view dashboard is a practical prototype module, not a final application architecture. Extract per-section modules and typed query hooks when introducing report APIs. Keep the shared table/chart/drawer presentation intact. Move authoritative calculations, authorization, stock mutation and shared settings to FastAPI; retain the fixture provider as a switchable demo/testing source. Add a query cache with authorized scope/settings/snapshot keys and a runtime response validator. Do not simply expose the entire ledger as a production substitute for the current `load()` method.
