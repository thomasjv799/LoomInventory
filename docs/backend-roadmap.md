# Backend implementation roadmap

**Historical proposal, superseded on 8 October 2026.** The running source now uses Convex/TypeScript and Better Auth. The SQL/FastAPI/Supabase material below is retained for reference, not an additional deployed service. Use [backend setup](backend-setup.md), [runtime schema](../convex/schema.ts), [implemented API](api/convex-openapi.json) and [deployment runbook](deployment-runbook.md) for current work. The production follow-ups are scalable incremental report aggregates, live provider/deployment smoke tests, load tests, backups and restore drills.

## Original proposal

This phase defines data and API contracts. It does not implement hosted storage, imports or operational writes. Preserve the functioning fixture prototype while introducing one backend slice at a time.

## 1. Contract and database validation

Review the OpenAPI and relational core. Confirm actual SKU/size identities, price semantics, store assortment, seasons, ownership and source-system keys with the business. Use the normalized demo package to validate imports into a local PostgreSQL environment. Add production entities listed in database-design.md and generate actual migrations after local validation.

Acceptance: PK/FK checks pass; no cross-organization references; demo ledger balances, sales revenue, transit and forecasts reconcile; schema rollback/rebuild works in a test database. Do not use production credentials for this gate.

## 2. Authentication and authorized read APIs

Create FastAPI typed response models and Supabase identity verification. Implement membership/location authorization, error envelopes, pagination and bounded queries. Deliver products, locations, inventory and product detail before additional analytics.

Acceptance: missing token → 401; wrong organization/location → 403 or non-disclosing 404; invalid filters → 422. Unauthorized rows must not appear in results, aggregates, CSVs or caches. Add multi-tenant tests with at least two organizations and two store roles.

## 3. Report parity and provider transition

Implement the seven report groups and versioned settings. Compare their rows/totals against the same demo fixtures and metric definitions. The existing `DataProvider.load()` returns the whole Dataset; it is a prototype seam, not yet a report client. Extend it with typed report methods and adapt screen data hooks while retaining presentational components. Do not ship a full-history snapshot endpoint as the normal production data path.

Acceptance: all fifteen questions produce equivalent demo answers, summary/detail totals reconcile, filters remain linkable, forecast scope/ignored filters are explicit and CSV equals the authorized report scope. Keep a fixture-provider mode for demos and testing.

## 4. Import dry-run, then transactional commit

Build source templates, field mapping, validation and reject reports for the eleven inputs. Store import hashes/source keys. Preview additions and reconciliation before commit. Link sales to their existing deductions when importing separate feeds. Store source IDs and row numbers; no silent coercion of unknown sizes/prices.

Acceptance: duplicate import is harmless; conflicting payload is rejected; malformed rows never partially commit; sales cannot deduct twice; opening cutoff prevents overlap; server permissions apply to import jobs and error files.

## 5. Stock operations after read accuracy

Introduce approved transfer dispatch/partial receipt, reservations, quarantine release, returns and corrections. Use immutable ledger events, row locks, idempotency, actor/reason audit and transactionally reliable jobs.

Acceptance: concurrent transfers cannot allocate the same stock; repeated receipt cannot double stock; over-receipt and insufficient-stock return 409; paired movements remain atomic; ownership survives consignment; exceptions have explicit resolution history.

## 6. Forecast and production readiness

Replace demo forecasts only when dense real history and stockout/season/lead-time evidence exist. Backtest by store and size against a simple baseline, report error and insufficient evidence, and keep forecast run provenance. Add monitoring, reconciliation alerts, backups/restore drills, structured request IDs, performance budgets and deployment automation.

Acceptance: agreed report latency/data freshness, tested restores, no browser secrets, permissions reviewed, audit retention decided, forecasts assessed on held-out history. Enterprise readiness is the outcome of these gates, not a label attached to the prototype.
