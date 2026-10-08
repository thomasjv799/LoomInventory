# Data dictionary and import package

## Three representations, one source

1. `data/mock-data.json` is the canonical generated fixture. `public/mock-data.json` is its identical browser copy. `scripts/generate_mock.py` generates both using seed 799.
2. `data/inputs/` contains the eleven requested sheet-like input projections. These are views of the same fixture, not independent balances to add together.
3. `data/normalized/` contains one JSON object per line per relational table, with stable IDs, foreign keys, minor-unit money, explicit nulls, import order and SHA-256 checksums. `scripts/export_database_seed.py` produces it from the fixture and image manifest. It does not scrape, mutate source records or contact a database service.

Regenerate and validate in this order:

```sh
npm run seed
npm run check:data
python3 scripts/export_database_seed.py
python3 -m unittest discover -s tests -p 'test_data_contracts.py'
```

`data/normalized/manifest.json` records schema version, seed, synthetic status, as-of date, table counts, checksums and load order. `table-contract.json` lists every column, nullability, SQL type, foreign key, check and unique key. `docs/database/relational-core.sql` is the portable relational schema used by validation. The PostgreSQL draft is described separately.

## Conventions

- Organization: `loom-demo`. A stable text identifier suits the demonstration; future organizations may use UUID strings. Every business primary key is `(org_id, id)` and related entity foreign keys include org_id.
- Dates: ISO `YYYY-MM-DD` local business dates in Asia/Kolkata. The fixture lacks intraday timestamps. Production should add `occurred_at` and `recorded_at` UTC timestamps without inventing them for these rows.
- Money: integer INR paise. `238000` means ₹2,380. Product cost and suggested MRP are product-master values. Transaction MRP is per-unit recorded MRP; net line value is the total across the line quantity. Unit selling price is derived as `net_line_value_minor / quantity`.
- Quantities: integer units. Inventory ledger deltas are signed; sales, receipts and reservations have positive quantities.
- Null: unknown/unverified, never an empty placeholder for a genuine zero. Two image references have unrecorded source dimensions: exported dimensions are null, while fixed display dimensions remain a UI concern. No additional image verification is claimed for those dimensions.
- Source attributes: product provenance is preserved in `provenance_json`. Name/image and specified attributes can be source-backed; operations, prices, size ranges and matching relationships are simulated. JSON-in-text is deliberate in the portable draft; later migrations may use JSONB.
- Channel values in persisted sales: `Ecommerce` and `Store`. The UI's “Stores” label is not the stored enum. The proposed API uses these persisted enum values and maps labels at the presentation boundary.
- Booleans in the portable core: constrained integers 0/1. API payloads use booleans. The final PostgreSQL migration can convert them to native boolean while updating the importer.

## Normalized tables

| Table                  | Important fields                                                                                          | Meaning                                                                                  |
| ---------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| organizations          | id, name, currency, timezone                                                                              | Demo organization scope                                                                  |
| locations              | id, kind, city                                                                                            | HO plus five fictional stores; ecommerce is a channel, not a seventh stock location      |
| bins                   | location_id, excluded                                                                                     | Storage and Dispatch center exclusion; ledger bin/location FK prevents a mismatched pair |
| products               | sku, category, attributes, launch_date, cost_minor, suggested_mrp_minor, provenance_json                  | Style/product master; size belongs to variants                                           |
| product_images         | product_id, url, source_product_url, dimensions, verified_on, alt                                         | Referenced primary image; unverified secondary images absent                             |
| variants               | product_id, sku, size                                                                                     | 150 sellable size identities including Free-size dupattas                                |
| transfers              | variant_id, source_id, destination_id, dispatched_qty, dispatch_date, eta, owner_org_id                   | One variant per demo transfer. Ownership remains central                                 |
| inventory_ledger       | variant_id, location_id, bin_id, condition, quantity_delta, effective_date, reason, transfer_id           | Openings and all stock changes, including sales deductions, in one ledger                |
| transfer_receipts      | transfer_id, quantity, received_date, movement_id                                                         | Received portion; remaining transit is derived, not inserted as stock                    |
| sales_orders           | source_reference, location_id, channel, sale_date                                                         | Consistent order headers; see bill-reference qualification below                         |
| sales_lines            | order_id, variant_id, quantity, transaction_mrp_minor, net_line_value_minor, movement_id, matching_status | Financial/demand records linked one-to-one with their stock deduction                    |
| reservations           | variant_id, location_id, quantity, as_of                                                                  | Active demo reserved quantities; future reservations need expiry/status/source           |
| matching_relationships | outfit_id, dupatta_id, ratio, description                                                                 | Explicit simulated mapping; eight relationships, all ratio one                           |
| events                 | start_date, end_date, kind, multiplier, source_url, note                                                  | Referenced dates or fictional demand windows, labelled individually                      |
| influencer_activity    | product_id, activity_date, name, kind, channel, note                                                      | Fictional activity observations                                                          |
| forecast_runs          | as_of, scope, status, assumptions_json                                                                    | Network, precomputed demo, known assumptions                                             |
| forecast_values        | run_id, variant_id, month, units, factor, method                                                          | Variant-month forecasts; product-month totals are derived                                |

Generated balances and product-month forecasts are validation expectations, not extra inventory or demand tables to sum alongside their ledger/variant values. Scenario labels remain in the UI fixture for demonstration; they are not business facts to import into production.

## Eleven logical inputs

| Input file in data/inputs | Future import target                                      |
| ------------------------- | --------------------------------------------------------- |
| product-master.json       | products, variants, product_images                        |
| opening-ho.json           | inventory_ledger with is_opening = 1 for HO               |
| opening-stores.json       | inventory_ledger with is_opening = 1 for stores           |
| ho-additions.json         | Positive HO inventory_ledger rows                         |
| ho-reductions.json        | Negative HO inventory_ledger rows                         |
| ecommerce-sales.json      | sales_orders, sales_lines; link existing ledger deduction |
| store-sales.json          | sales_orders, sales_lines; link existing ledger deduction |
| influencer-activity.json  | influencer_activity                                       |
| event-calendar.json       | events                                                    |
| bin-data.json             | bins                                                      |
| store-transit.json        | transfers and transfer_receipts                           |

Do not import these projections and the normalized package together: that would repeat the same records. Store transfer movements and quarantine releases are fully represented by the canonical ledger. A sale import must create or link its one deduction atomically, never deduct again because a sale row arrived separately.

## Bill-reference qualification

The UI fixture reused some `orderId` labels across different dates, locations and channels. Normalized order ID is `source bill reference | sale date | location | channel`. Original references remain in `source_reference`; line IDs and movement IDs remain unchanged. A production importer should instead use a source-system order key scoped to its organization and connector, reject conflicting headers, and retain a reversible external-ID mapping. Do not copy the demo's composite display ID as a production uniqueness strategy.

## Later database import procedure

Load into an isolated demo/staging environment. Verify manifest checksums and schema version, begin a transaction, insert organization then tables in load order, validate foreign keys and business reconciliations, and commit only if all checks pass. Re-running an import must detect an existing batch/source identity and either no-op an identical batch or reject changed payloads; blind appending is prohibited. Production import batches and dry-run error records are next-phase additions, not currently implemented.

Current exporter validation uses SQLite in memory with foreign keys enabled. It checks every PK/FK/CHECK, bin/location consistency, ledger-to-fixture balances, one stock deduction per sale with matching date/location/variant, total transaction revenue and dispatched-minus-received transit. Additional tests cover deterministic exports and forecast allocations. PostgreSQL compatibility, role grants and RLS require a real PostgreSQL test environment next phase.
