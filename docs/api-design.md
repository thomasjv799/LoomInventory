# Proposed FastAPI API contract

**Design only.** [openapi.json](api/openapi.json) is an OpenAPI 3.1 artifact for the next milestone; none of its routes are currently running. The Next.js prototype still fetches `/mock-data.json`. Regenerate the contract with `python3 scripts/build_api_contract.py` after regenerating the normalized data contract.

Use `/api/v1`, typed Python request/response models and JSON envelopes. Generate runtime OpenAPI from those models later and compare it with this design contract in CI. FastAPI's [response-model documentation](https://fastapi.tiangolo.com/tutorial/response-model/) describes how typed responses validate and filter output. This contract is our proposed design, not an API provided by The Loom.

## Validate the design artifact

The generators and contract tests use Python's standard library. Full specification validation uses an optional development tool:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-contract.txt
.venv/bin/python -m openapi_spec_validator docs/api/openapi.json
```

This checks OpenAPI structure, not whether an unimplemented server satisfies it. The backend milestone needs runtime response and authorization tests as well.

## Read endpoints and screen mapping

| Route                                 | Screen / purpose                                                                             |
| ------------------------------------- | -------------------------------------------------------------------------------------------- |
| GET /locations                        | Filter choices limited to permitted locations                                                |
| GET /products                         | Search/filter catalogue                                                                      |
| GET /products/{product_id}            | Product, images, variants, availability, bounded movements, trend and suggestions for drawer |
| GET /inventory                        | Inventory table/matrix source and matching stock totals                                      |
| GET /reports/overview                 | Overview stock metrics and paginated attention rows                                          |
| GET /reports/stores                   | Store/product health, completeness and classification                                        |
| GET /reports/rotation                 | Feasible shared-pool rotations                                                               |
| GET /sales                            | Transaction records and revenue/price-completeness summary                                   |
| GET /reports/sales                    | Attributes, actual-price bands, size mix, fixed trends and timeline                          |
| GET /reports/replenishment            | Cover-based HO-to-store recommendations                                                      |
| GET /reports/ho-shortages             | Recently selling HO sizes needing production                                                 |
| GET /reports/slow-stock               | Store-held slow/inactive units for outward review                                            |
| GET /reports/size-packs               | Exposure, stockout days and cover-based size quantities                                      |
| GET /reports/forecasts                | Versioned precomputed network size forecasts                                                 |
| GET /transfers                        | Dispatch, received and outstanding transit status                                            |
| GET /transfers/{transfer_id}/receipts | Partial/completed receipt records                                                            |
| GET /reports/events                   | Calendar, fictional activities and demand overlays                                           |
| GET /reports/dupatta                  | Explicit mappings, known attachment and shared-pool coverage                                 |
| GET /settings                         | Versioned organization-level settings                                                        |
| GET /exports?report=inventory         | CSV for all filtered primary-report rows                                                     |

The fifteen questions map to these endpoints in the same order as README's report matrix: inventory/replenishment, HO shortages, rotation, sales attributes, prices/sizes, slow stock, inactive inventory, ten-day trends, seven-day trends, forecasts, receipts, size packs, size packs, store health, dupatta. Forecasting is demonstration output until a production model is validated.

## Parameters and filter semantics

Snake-case API names map to existing UI URL names: `location` → `location_id`; `fast=1` → `fast_only=true`. Channel labels map to `Ecommerce` or `Store`. Preserve `q`, `from`, `to`, category, fabric, colour (`color`), craft, size and applicable stock status. Responses echo applied and ignored filters.

Dates are inclusive business dates; default sales period is the 28 complete days preceding as_of. Reject from > to and future sales periods. Current inventory quantities always use the declared snapshot. Trend endpoints use fixed adjacent seven-/ten-day windows regardless of historical selection. Calendar uses its own year. Network forecasts accept catalogue/size filters for selecting rows; they ignore location/channel/date filters and report that explicitly in meta. They never claim to be recomputed by a cover change.

Paged list routes use `page` (default 1), `page_size` (default 25, maximum 100), an allowlisted `sort` field and `direction`. Apply a stable ID tie-break. Invalid sort fields return 422; never interpolate raw query text into SQL. Default sort is SKU/size/location for inventory, ID for simple resource lists, lowest cover/highest rate for suggestions, newest sale date then ID for sales, and month/variant for forecasts. A later high-volume backend can introduce cursors through a versioned contract change.

Product detail defaults to the recent 28-day movement window and rejects windows over 90 days; more history should be paginated through a dedicated history route later. Reject unknown IDs or unauthorized scope without leaking entity details. Replenishment/rotation/dupatta allocation runs on one complete authorized scope before pagination; a page must not recalculate its own independent source pool. Production shared-network recommendations require network permission; a store viewer receives an already-authorized projection or a forbidden response, never hidden donor inventory.

## Response conventions

JSON responses have `data` and `meta`; reports may also have typed `totals` or `summary`. Meta includes request ID, snapshot/as-of, synthetic status, INR/paise/timezone, settings version, applied/ignored filters, warnings, pagination and full filtered row count. Totals cover all filtered rows before pagination, never the current page only.

Resource schemas follow the normalized table names. Computed report schemas are distinct: InventoryRow, RecommendationRow, StoreHealthRow, TrendRow, ForecastRow, DupattaRow and others. Money is integer paise within JavaScript-safe range. Nullable values remain null. Missing sales prices produce unpriced-unit counts, not made-up MRP revenue. Forecast rows expose network scope, precomputed-demo status, method and evidence.

Errors use one body shape:

```json
{
  "code": "INSUFFICIENT_STOCK",
  "message": "Available stock changed; review the transfer quantity.",
  "request_id": "req-example",
  "details": [
    {
      "field": "quantity",
      "issue": "Requested quantity exceeds available stock."
    }
  ]
}
```

401 means missing/invalid identity; 403 forbidden scope; 404 absent/non-disclosing resource; 409 stock, idempotency or settings-version conflict; 422 invalid filter/input; 429 throttled. Log internal diagnostics with request ID, but never expose database details or tokens in messages.

## Exports

`GET /exports` uses the same report parameters, permissions and snapshot as JSON. Return `text/csv`, an attachment filename and X-Snapshot-ID. Export all filtered primary-report rows; forecasts remain a separate report. Escape formula-like cells. The initial synchronous contract caps export at 100,000 rows and returns 422 above that limit; asynchronous export jobs are later work. Settings are not exportable through this route.

## Later import and write contracts

These routes are explicitly marked future-import/future-write in OpenAPI:

| Route                                  | Transaction requirement                                                                                 |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| POST /imports/dry-run                  | Validate up to 10,000 source rows, return rejected rows and immutable content hash; no stock change     |
| POST /imports/{import_id}/commit       | Hash must match approved dry-run; atomic commit with source-key deduplication                           |
| PATCH /settings                        | Full values document plus If-Match version; forecasts remain unchanged                                  |
| POST /transfers                        | One-variant prototype dispatch request; atomically validate/reserve/deduct source                       |
| POST /transfers/{transfer_id}/receipts | Positive partial receipt; lock transfer and reject over-receipt; create destination movement atomically |

All write/import requests require Idempotency-Key. Scope it to organization, route and key, retaining the request hash and result. Same key and payload returns the original result; changed payload returns 409. If-Match prevents lost settings updates. The import row payload is deliberately generic at dry-run entry because each sheet has a different source schema; per-dataset validation must reject unknown columns/types using versioned templates before commit. It does not imply arbitrary JSON can enter ledger tables.

Transfer dispatch example (INVENTORY_OPERATOR plus location/network grants):

```json
{
  "variant_id": "P001-M",
  "source_id": "HO",
  "destination_id": "S1",
  "quantity": 4,
  "eta": "2026-10-09",
  "reason": "Approved store replenishment"
}
```

The idempotency, authorization, lock and audit tables needed to implement these routes are not in the demo relational core. Returns, QC release, multi-SKU transfer orders and reservation writes need additional contracts before implementation. Do not expose a generic mutable-balance endpoint.

## Identity and permissions

Bearer identity is required for all proposed routes. Determine org membership and location grants server-side; do not trust an org header or editable client role. The `x-minimum-role` annotation expresses a capability category, not an ordinal role hierarchy. Operators still need the relevant locations and action permissions. Viewer access to aggregated totals/export must obey the same scope as row access. Administrator-only settings updates validate `average <= hit`, `slow <= fast` and supported core sizes.

## Compatibility and versioning

Keep the current fixture provider for demos. Add a report-provider interface and screen hooks as reads are implemented; the present `load(): Promise<Dataset>` seam needs extension for paginated APIs. Map snake-case API models to existing TypeScript report models at this boundary. Preserve UI filtering and drawer behavior while moving calculations server-side. Introduce new metric semantics behind a settings/algorithm version and parity tests, rather than silently changing the meaning of displayed totals.
