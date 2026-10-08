# The Loom · Inventory Studio

A Next.js/TypeScript inventory dashboard with a Convex database, scoped report and stock APIs, and Better Auth Google/Microsoft sign-in. All eight sections support explicit local demo mode; authenticated mode uses authorized, paginated backend reports. **All committed business data is simulated.** Provider credentials and cloud deployment remain external setup steps.

See [backend setup](docs/backend-setup.md), [deployment runbook](docs/deployment-runbook.md) and [implemented HTTP contract](docs/api/convex-openapi.json). Add product creates a style and its sizes with zero stock; receipts are separate stock operations.

## Run locally

Copy `.env.example` to `.env.local` and keep `NEXT_PUBLIC_DATA_MODE=demo` for credential-free review. For authenticated mode, follow the backend setup guide.

Requires Node 24 and Python 3.10+. Python uses only its standard library.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3000. Fixture JSON is committed, so Python is needed only to regenerate or validate it.

```sh
npm run seed
npm run check:data
npm test
npm run typecheck
npm run build
npm start
```

The production build uses Webpack because this development host restricts Turbopack build-worker port binding. Development uses Next's default bundler.

## Review the screens

Overview → Inventory → Stores & Rotation → Sales & Attributes → Replenishment & Forecasts → Events & Influencers → Dupatta Analysis → Settings. Use the sidebar on desktop or the navigation menu on smaller screens. Filters live in URL parameters and survive navigation; search accepts a product SKU such as `LM-P001` or a variant such as `LM-P001-M`.

Inventory switches between location rows and a size matrix. Product buttons open an image/attribute/stock/movement drawer. Suggestions have explanatory panels and perform no operation. Charts include tooltips and a data-table alternative. Top-level CSV exports include all filtered rows of the section's primary report, not just the current page; supplementary report definitions are documented in QA. Local settings persist across refresh and can be reset.

The demo snapshot is **6 October 2026**. Historical sales dates end on 5 October. Current inventory is a fixed as-of snapshot; date filters select historical sales and receipts. The latest 90 days are generated daily; older sales use sparse 28-day sampling. New styles have no sales before launch.

## Data and image references

- `scripts/generate_mock.py`: deterministic seed 799; movement-led accounting.
- `data/mock-data.json` and `public/mock-data.json`: identical fixtures consumed through an asynchronous provider.
- `data/inputs/`: eleven logical input projections, generated from the same ledger.
- `data/image-manifest.json`: 30 verified public primary image references, dimensions, alt text, source product URLs and attribute provenance. Secondary URLs are null where no gallery reference was verified. Remote images are lazy loaded with fixed dimensions and a stable fallback.
- `lib/types.ts`, `lib/provider.ts`: shared interfaces and asynchronous fixture provider for later replacement by FastAPI.
- `docs/QA.md`: accounting rules, assumptions and verification record.
- `docs/screenshots/`: desktop screen set and responsive review images.

Imagery comes from The Loom's public catalogue. Fabric, craft and colour are source-backed only where present in source names; other attributes are labelled simulated. Costs, suggested MRP, transaction MRP, net prices, stock, fictional stores/creators and matching relationships are simulated. No commercial asset licence is asserted.

Diwali date records include source references from the [Government of India 2024 calendar](https://cbcindia.gov.in/wp-content/uploads/vbsy_material/national/calendar/cal_2024.pdf) and [Drik Panchang](https://www.drikpanchang.com/hindu-festivals/diwali/diwali.html). Regional observance may differ. Shopping windows, seasonal multipliers and creator activity are demonstrations.

## Where the fifteen questions are answered

| Question                                                | Visible report                                                 |
| ------------------------------------------------------- | -------------------------------------------------------------- |
| 1. Store selling sizes missing with HO supply           | Inventory: available / HO available; replenishment suggestions |
| 2. HO selling sizes unavailable                         | Overview stockouts → Replenishment: HO shortages               |
| 3. Feasible store rotation                              | Stores: Store rotations                                        |
| 4. Store attribute preferences                          | Sales: fabric/craft/colour/style tables + store filter         |
| 5. Store actual price bands and size mix                | Sales: price and size charts + store filter                    |
| 6. Store non-sellers / slow stock                       | Stores: Slow stock by store                                    |
| 7. Ecommerce held inactive stock                        | Inventory: Held inventory + Ecommerce channel                  |
| 8. Last ten-day sales declines                          | Overview and Sales: Ten-day declines                           |
| 9. Last seven-day sales increases                       | Overview and Sales: Seven-day increases                        |
| 10. SKU / size month / season projection                | Replenishment: precomputed size forecasts                      |
| 11. Received replenishment and elapsed time             | Replenishment: Replenished after sales                         |
| 12. Fast-selling size stockout days                     | Replenishment: Size packs, Fast seller stockouts toggle        |
| 13. Peak / non-peak size rationalisation                | Replenishment: size weights and cover-based unit suggestions   |
| 14. Broken / healthy, fresh units, Hit / Average / Miss | Stores: store cards and assortment health                      |
| 15. With / without matching dupatta demand              | Dupatta: attachment, unknown, pairs covered and shortage       |

## Documentation and backend handoff

Start with the [documentation index](docs/README.md), [dashboard guide](docs/dashboard-guide.md) and [metric definitions](docs/metrics.md). The [data dictionary](docs/data-dictionary.md) explains the 17-table [normalized import package](data/normalized/manifest.json); the [database design](docs/database-design.md), [API design](docs/api-design.md), [OpenAPI contract](docs/api/openapi.json) and [backend roadmap](docs/backend-roadmap.md) define the next milestone. The earlier SQL/FastAPI artifacts are historical proposals; the Convex schema and HTTP contract describe the current source.

```sh
npm run seed:database
npm run contract:api
npm run check:contracts
```

The export preserves all stock/sales records, qualifies reused synthetic bill references into consistent order headers, and validates ledger balances, transaction revenue, transit and relational keys locally. It is separate from the browser fixture; both derive from the same generated source. All monetary amounts use integer INR paise.

## Next milestone

The Convex source now supplies authentication, membership permissions, ledger operations, normalized snapshot imports and authorized reports. Before production, configure provider/deployment credentials, run isolated live smoke tests, and extend the capped workers into scalable incremental aggregates. Backups, recovery drills, approval workflows and production forecasts remain follow-up work.
