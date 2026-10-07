# Convex Backend and Better Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect all eight inventory screens to an authorized Convex backend, add Google/Microsoft login and catalogue creation, implement stock/import APIs, and push a tested Netlify-ready source package.

**Architecture:** Better Auth runs through its official Convex component and a same-origin Next.js authentication proxy. Convex owns business data, immutable stock movements, authorized report runs and HTTP adapters; the dashboard consumes bounded report results through a replaceable provider. Explicit fixture mode remains available locally.

**Tech Stack:** Existing Next.js/TypeScript/Tailwind/Radix/Recharts frontend; Convex, @convex-dev/better-auth, compatible pinned Better Auth; Vitest/convex-test, Python fixture tools, Netlify and GitHub Actions.

**Spec:** [Approved design](../specs/2026-10-07-convex-backend-auth-design.md).

## Global Constraints

- Currency INR; trading timezone Asia/Kolkata; integer paise within JavaScript-safe range; integer quantities; UTC operational timestamps.
- Synthetic catalogue: thirty products, 150 variants, 7,471 sales, 15,953 movements and 38,070 normalized rows. Demo as-of date remains 6 October 2026.
- Google/Microsoft social sign-in only. No password login, anonymous authentication, public administrator registration or domain-based automatic access.
- Generate Convex `_generated` files using actual tooling; pin component-compatible Better Auth in the lockfile. Read installed Next.js guidance before changing routes/providers.
- Every public function enforces current membership, organization and referenced location scope. No public fixture fallback in authenticated mode.
- Cursor pagination: default 25/max 100. Imports: at most 100 rows per chunk plus a serialized byte cap below platform limits.
- Sales deduct inventory once; transit becomes available upon receipt; quarantine and Dispatch center quantities remain unavailable; consignment retains central ownership.
- Forecasts remain labelled precomputed demonstrations. Recommendations allocate a shared donor pool once and do not reserve stock.
- Preserve HO – Central Warehouse, plain store names, missing-size terminology and section-specific Events controls.
- Login copy: “Sign in to Inventory Studio” and “Access is managed by your administrator”; ivory #F7F5F0, ink #17252D, bronze #946A35, Newsreader/Roboto.
- No full warehouse-operation UI, live POS/ecommerce integrations, second backend/database, account purchase or public deployment in this milestone.
- Keep work on the existing feature branch and draft PR; push source, never secrets. Do not merge the PR.

## Review Focus

1. Revoked membership or narrowed store grants must invalidate cached report pages and exports, even with a valid session — Tasks 2 and 5.
2. A changed filter, tied sort or stale watermark must not mix pages/totals or reuse a donor pool independently — Tasks 3 and 5.
3. Retried or simultaneous deductions must not duplicate sales, oversell source stock or over-receive transfers — Task 6.
4. A crashed import or operational write during staging must not publish partial data or discard a concurrent change — Task 7.
5. Missing hosted configuration, hostile callback destinations and sign-out must never expose fixture data or cached inventory — Tasks 2 and 8.

---

## Shared contracts and file boundaries

Extend `lib/types.ts` with public DTOs; keep Convex IDs internal and return external business IDs. New `lib/contracts.ts` owns strict input/filter/error schemas and `lib/report-types.ts` owns screen-specific results. `ReportName` covers overview, inventory, stores, rotation, sales, replenishment, ho-shortages, slow-stock, size-packs, forecasts, events and dupatta. `ReportEnvelope<T>` contains data, totals and meta (requestId, asOf, synthetic, currency, timezone, sourceWatermark, settingsVersion, algorithmVersion, appliedFilters, ignoredFilters, nextCursor).

`InventoryProvider` in `lib/provider.ts` exposes `getLocations()`, `listProducts(input)`, `getProduct(productId)`, `getReport(name, filters, page)`, `getSettings()`, `updateSettings(values, expectedVersion, idempotencyKey)`, `createProduct(input, idempotencyKey)` and `exportReport(runId, filters)`. All methods return promises of typed DTOs; no production `load(): Promise<Dataset>`. `lib/providers/fixture.ts` adapts current analytics; `lib/providers/convex.ts` delegates to generated functions. Report queries return pending/ready/stale states explicitly.

Backend modules expose generated functions while `convex/domain/*` contains reusable authorized operations. HTTP actions call those same functions with the caller's authenticated context; no admin/service-token bypass. Errors use stable codes UNAUTHENTICATED, FORBIDDEN, INVALID_INPUT, NOT_FOUND, CONFLICT and INSUFFICIENT_STOCK, mapped to 401/403/422/404/409.

## Task 1: Typed database and deterministic seed foundations

**Files:** Create `convex/schema.ts`, `convex/convex.config.ts`, `convex/domain/validation.ts`, `convex/domain/seed.ts`, `convex/seed.ts`, `scripts/seed-convex.ts`, `tests/backend/seed.test.ts`, `tests/backend/setup.ts`; modify `package.json`, `package-lock.json`, `tsconfig.json`.

**Interfaces:** Produce typed schema tables/indexes from the approved model; `validateSeedRow(table, row): ValidationResult`; internal `seed.stageChunk({organizationId, datasetVersionId, table, chunkKey, rows})`; `seed.reconcile({organizationId, datasetVersionId})`. No public unauthenticated seed function.

- [ ] Write `seed.test.ts`: assert 30 products/150 variants; mapped references remain in one organization/version; duplicate chunk replay keeps counts unchanged; dangling/cross-organization references and unsafe money reject; balances, sales revenue and unreceived transit match normalized fixtures.
- [ ] Run `npm test -- tests/backend/seed.test.ts`; expect missing-module/function failures before implementation.
- [ ] Install the official component and compatible pinned versions after verifying current primary documentation; register component, define all schema tables/indexes from the spec, add scoped uniqueness/reference validators and bootstrap test harness. Generate real Convex types using supported tooling; disclose if tooling requires a configured deployment.
- [ ] Implement dependency-ordered remapping and bounded chunk seed staging with a 256 KiB serialized payload cap; use explicit development/preview guard, source hash and version reconciliation. Keep production activation for Task 7.
- [ ] Run seed tests, `npm run typecheck` and existing Python fixture tests; require exact fixture parity and no regressions.
- [ ] Commit: `feat: add typed Convex schema and repeatable fixture staging`.

## Task 2: Authentication, authorization and login UI

**Files:** Create `convex/auth.ts`, `convex/auth.config.ts`, `convex/access.ts`, `convex/memberships.ts`, `convex/bootstrap.ts`, `lib/auth-client.ts`, `lib/auth-server.ts`, `lib/auth-redirect.ts`, `app/api/auth/[...all]/route.ts`, `app/login/page.tsx`, `components/auth-provider.tsx`, `components/workspace-gate.tsx`, `components/login-form.tsx`, `tests/backend/access.test.ts`, `tests/auth.test.ts`; modify `app/layout.tsx`, `app/page.tsx`, `app/globals.css`.

**Interfaces:** `requireAccess(ctx, {organizationId, capability, locationIds?}): Promise<AccessScope>` resolves identity, membership and active dataset. `AccessScope` includes authUserId, organizationId, allowedLocationIds, networkRead and costRead. Generated `memberships.me`, `memberships.organizations`, administrator-only `memberships.set`; internal `bootstrap.firstAdministrator({authUserId, organizationId})`. `safeReturnTo(value): string` accepts same-origin application paths only.

- [ ] Write tests with two organizations and assigned-store identities: unauthenticated → denied; signed-in without membership → pending; disabled membership → denied; viewer costs absent; hidden location/network access denied; transfer needs both locations; public bootstrap unavailable. Test `//evil.example`, external URLs and encoded redirect attempts resolve to `/`; sign-out clears organization/report caches.
- [ ] Run `npm test -- tests/backend/access.test.ts tests/auth.test.ts`; expect missing implementation failures.
- [ ] Implement official Better Auth Convex/Next bridge and cookie proxy, Google/Microsoft configuration, capability checks, audited membership changes and targeted internal bootstrap. Distinguish authentication from membership and check permissions on every backend call.
- [ ] Implement login and workspace boundary states: pending, error, missing configuration, expired session and access pending. Apply UI/UX Pro Max guidance; preserve focus and reduced-motion behavior. Explicit local demo mode bypasses cloud login only in demo builds.
- [ ] Run targeted tests/typecheck; inspect login at 375/768/1024/1440px and keyboard focus. Record OAuth callbacks as unverified until actual provider credentials exist.
- [ ] Commit: `feat: add Better Auth login and scoped workspace access`.

## Task 3: Catalogue and inventory read APIs

**Files:** Create `convex/catalogue.ts`, `convex/inventory.ts`, `convex/domain/catalogue.ts`, `convex/domain/inventory.ts`, `lib/contracts.ts`, `lib/report-types.ts`, `tests/backend/catalogue.test.ts`, `tests/backend/inventory.test.ts`; modify `lib/types.ts`.

**Interfaces:** Generated `catalogue.list({organizationId, filters, cursor?, limit?})`, `catalogue.detail({organizationId, productId})`, `catalogue.create({organizationId, input, idempotencyKey})`, `catalogue.update({organizationId, productId, input, expectedVersion, idempotencyKey})`, `catalogue.archive`; `inventory.list` and `inventory.movements` use the same scope/filter/page contract. Product detail includes images, attributes, authorized availability, bounded sales/movements and evidence.

- [ ] Write tests: duplicate style/size rejects; creation atomically returns variants/images with zero stock; archive preserves historical references; stale update conflicts; cost redaction holds for list/detail; tied sorts produce no duplicates/omissions over pages; limit 101, malformed date, unknown field and foreign ID reject. Inventory totals equal all filtered rows before pagination; unavailable bins/transit/quarantine stay separate.
- [ ] Run the two targeted test files; expect absent functions/types failures.
- [ ] Implement strict request schemas, indexed scoped queries with stable tie-breaks, integer money validation and atomic versioned catalogue writes. Use source-backed image metadata and intentional missing-image fallback rather than invented matching photos.
- [ ] Run tests/typecheck; compare fixture and server inventory quantities for every variant/location.
- [ ] Commit: `feat: add scoped catalogue and inventory APIs`.

## Task 4: Report provider and connected frontend

**Files:** Create `lib/providers/fixture.ts`, `lib/providers/convex.ts`, `lib/report-adapters.ts`, `components/product-create-drawer.tsx`, `components/report-boundary.tsx`, `tests/provider.test.ts`; modify `lib/provider.ts`, `components/dashboard.tsx`, `components/data-table.tsx`, `components/product-image.tsx`.

**Interfaces:** Implement the `InventoryProvider` contract above. `createInventoryProvider(mode, client?): InventoryProvider`; `ReportBoundary` accepts pending/ready/stale/error; product creation accepts SKU/name/category/attributes/applicable sizes/cost/suggested MRP/image references, with no stock quantity field.

- [ ] Write provider tests: fixture/Convex methods return identical DTO shapes; authenticated mode never fetches `mock-data.json`; filter/cursor context remains in URL; error/pending states preserve context; new product appears with zero stock; failed submission retains input; fixture creation/settings persist locally with explicit synthetic label.
- [ ] Run `npm test -- tests/provider.test.ts`; expect contract failures before replacing provider.
- [ ] Extract report assembly from the dashboard into adapters, switch Overview/Inventory/product drawer to bounded provider calls, and introduce Add product validation/focus restoration. Keep URL filters, sorting and pagination; backend pagination replaces full-array client pagination in Convex mode.
- [ ] Run provider and existing analytics/filter tests/typecheck; verify Overview and Inventory totals, drawers and creation manually in fixture mode and test-backed Convex mode.
- [ ] Commit: `feat: connect dashboard provider and add product creation`.

## Task 5: All reports, persistent settings and authorized exports

**Files:** Create `convex/reports.ts`, `convex/domain/reports.ts`, `convex/report-worker.ts`, `convex/settings.ts`, `convex/exports.ts`, `tests/backend/reports.test.ts`, `tests/backend/settings.test.ts`, `tests/backend/exports.test.ts`; modify `lib/analytics.ts`, `lib/report-adapters.ts`, `lib/providers/convex.ts`, `components/dashboard.tsx`.

**Interfaces:** `reports.request({organizationId, name, filters}): {runId, status}`; internal `reportWorker.advance({runId})`; `reports.page({organizationId, runId, cursor?, limit?}): ReportEnvelope`; `settings.get`, `settings.update({organizationId, values, expectedVersion, idempotencyKey})`; `exports.csv({organizationId, runId, cursor?})` returns authorized bounded CSV chunks with continuation and totals metadata.

- [ ] Write parity tests covering all fifteen questions and twelve report types: store/HO shortages, shared-pool rotation, attribute/actual-price/size performance, slow/dead stock, 7-day increases/10-day drops, seasonal projections, replenishment delays/stockout days/size ratios, fresh styles missing sizes, and explicit dupatta mappings. Assert unknown actual price stays unknown rather than suggested MRP; dispatch exclusions and timely inbound rules match existing analytics.
- [ ] Add tests: incomplete runs reveal neither rows nor totals; each page/export uses one watermark and settings version; changed filters request a different run; grants revoked after run creation deny old pages/exports; narrower permissions cannot reuse a network run; equal sorts stable; settings conflict/invalid threshold order reject; forecasts retain precomputed assumptions; CSV cells beginning with formula characters are escaped.
- [ ] Run the three test files; expect missing report/settings/export implementation failures.
- [ ] Implement bounded indexed aggregate preparation (`dailySales`, stock exposure intervals), resumable scheduled worker checkpoints and stable report rows. Fold batches into persisted accumulators; do not load the whole ledger into browser or one unbounded query. Compute rotation from one shared pool for the complete run; publish ready state only after reconciliation. Recheck current access on every page/export; tie expiry to source/settings/algorithm versions.
- [ ] Connect remaining six sections, settings and CSV through provider; keep event calendar year distinct from timeline date/location/channel and identify ignored filters. Export all filtered rows through bounded chunks rather than only the visible page. Surface loading, stale, empty and insufficient-evidence states.
- [ ] Run targeted plus existing analytics/filter tests/typecheck; manually follow each business question to an answer and reconcile totals against filtered details.
- [ ] Commit: `feat: add authorized inventory reports settings and exports`.

## Task 6: Transactional stock operations

**Files:** Create `convex/operations.ts`, `convex/domain/stock.ts`, `convex/domain/idempotency.ts`, `tests/backend/operations.test.ts`.

**Interfaces:** Generated `operations.receiveStock`, `recordSale`, `dispatchTransfer`, `receiveTransfer`, `quarantineReturn`, `releaseQc`, `moveBin`. Every request includes organizationId, idempotencyKey and typed operation fields; returns eventGroupId, affected external IDs and sourceWatermark. `withIdempotency(ctx, scope, operation, key, payload, execute)` stores canonical payload hash/result in the same mutation.

- [ ] Write tests: repeated identical sale creates one financial line/deduction; changed same-key payload conflicts; two dispatches competing for five units cannot dispatch eight; partial receipt increases only received stock and over-receipt rejects; quarantine release preserves physical total; cross-location bins reject; paired move preserves quantity while Dispatch center reduces available; consignment ownership retained; denied operation has no partial audit/ledger writes.
- [ ] Run `npm test -- tests/backend/operations.test.ts`; expect missing operations failures.
- [ ] Implement immutable ledger groups and balance updates in one Convex mutation, including sales price records, transfer state, audit and idempotency. Update daily aggregates/exposure and dataset source watermark transactionally. Reference-check every entity and both transfer locations; reject nonpositive/unsafe quantities and insufficient available stock.
- [ ] Run operation tests/typecheck and reconciliation. Document that simulated conflict tests require a separate real Convex concurrency smoke test once a deployment is configured.
- [ ] Commit: `feat: add atomic stock sales transfers and QC APIs`.

## Task 7: Validated eleven-input imports and atomic version activation

**Files:** Create `convex/imports.ts`, `convex/domain/imports.ts`, `scripts/import-convex.ts`, `tests/backend/imports.test.ts`; modify `convex/seed.ts`, `scripts/seed-convex.ts`.

**Interfaces:** `imports.create({organizationId, datasetType, sourceHash, cutoff, idempotencyKey})`, `stageChunk({organizationId, batchId, chunkKey, rows})`, `validate`, `commit`, `status`, `rejects`; internal `imports.advance({batchId})` and `imports.activate({datasetVersionId, expectedSourceWatermark})`. Dataset types match eleven committed input files; supporting normalized relationships are remapped during import.

- [ ] Write tests: all eleven input shapes accepted with correct references; invalid row has actionable reject location; oversized chunk rejects; same chunk retry harmless; imported sale linked to an existing deduction does not deduct twice and mismatched link rejects; opening cutoff required; failed/resumed batches never expose partial version. An operation after staging changes the watermark and prevents activation until revalidation/rebase, rather than silently dropping it.
- [ ] Run `npm test -- tests/backend/imports.test.ts`; expect missing import workflow failures.
- [ ] Implement staged validation, source-hash/reference maps, per-chunk idempotency and dependency-ordered writes into an inactive version. Reconcile ledger/balances/sales/transit before atomic active-pointer switch with expected current watermark. Report conflicts and preserve previous active version. Keep memberships/audit/idempotency outside dataset replacement.
- [ ] Run import/seed/operation suites and Python contract checks; execute seed twice against the test backend and compare counts/hashes.
- [ ] Commit: `feat: add resumable validated data imports`.

## Task 8: HTTP API, deployment configuration and handoff

**Files:** Create `convex/http.ts`, `convex/domain/http.ts`, `netlify.toml`, `.env.example`, `.github/workflows/check.yml`, `scripts/validate-environment.ts`, `scripts/build-deployment.ts`, `scripts/prepare-public-assets.ts`, `tests/backend/http.test.ts`, `tests/environment.test.ts`, `docs/backend-setup.md`, `docs/deployment-runbook.md`, `docs/api/convex-openapi.json`; modify `package.json`, `docs/api-design.md`, `docs/database-design.md`, `docs/backend-roadmap.md`, `docs/code-architecture.md`, `docs/README.md`, `README.md`.

**Interfaces:** `/api/v1` routes match the spec's identity/catalogue/stock/report/settings/import/export resources and delegate to generated authorized functions. `validateEnvironment(env, target): ValidatedConfig` supports explicit demo/convex modes, development/preview/production targets and URL validation. No static Next export.

- [ ] Write HTTP tests for session identity, scoped costs/totals, typed invalid requests and stable 401/403/422/404/409 mappings; compare representative HTTP and Convex results. Environment tests assert hosted missing config fails closed, secrets never use NEXT_PUBLIC prefixes, authenticated builds exclude public fixtures, production seed requires explicit synthetic guard, and build never implicitly seeds/reset data.
- [ ] Run targeted HTTP/environment tests; expect absent routing/guards failures.
- [ ] Implement thin authenticated HTTP routing and generated new OpenAPI contract; mark old SQL/FastAPI/OpenAPI proposals superseded. Add Netlify Convex deploy/build configuration with distinct preview/production keys, official supported Next runtime and explicit public deployment URL selection. Add CI typecheck/frontend/backend/Python checks and build, without requiring production credentials for fixture/test jobs.
- [ ] Document setup order: Convex projects, Better Auth secret, OAuth applications/callbacks, site origins, deploy keys in correct platforms, internal first-admin targeting, explicit seed command, Netlify domain and isolated preview. Include new-dress → variants → receipt example, API samples, deployment/rollback/version recovery and unmet live smoke tests; never invent credentials or claim deployment occurred.
- [ ] Run `npm test`, `npm run check:data`, `npm run typecheck`, `npm run build` and environment guards from a clean install; audit tracked files for secrets. Inspect all eight sections/login at 375/768/1024/1440px, keyboard navigation, drawer focus restoration, reduced motion and horizontal table scrolling. Save screenshots in `docs/screenshots/` and update QA evidence with exact verified/unverified boundaries.
- [ ] Obtain the execution method's required final code review, fix actionable issues, rerun affected tests, commit and push the existing branch. Update the attached draft PR description to the final implementation and validation. Do not deploy or merge without separate authorization/configuration.

## Execution and completion boundaries

Recommended execution: **Native**, because the eight tasks share authorization, DTOs and stock rules; one implementer can keep those interfaces consistent, followed by an independent final review. Subagent-driven execution remains an available choice for per-task independent reviews.

Source completion requires every task's credential-independent tests and frontend checks. Real Google/Microsoft sign-in, live Convex concurrency and Netlify runtime smoke tests remain explicit deployment checks until accounts, credentials and domains are supplied. Missing cloud inputs must not prevent completing the source, tests, documentation and GitHub push.

Self-review: database/model requirements map to Task 1; identity and role rules to Task 2; catalogue and bounded inventory to Tasks 3–4; every report/question/settings/export to Task 5; stock invariants to Task 6; all inputs and version isolation to Task 7; API/deployment/security guards and handoff to Task 8. All five Review Focus conditions have owning tests. Public interfaces use shared DTOs, internal documents use Convex IDs, and no task depends on production downloading the complete fixture dataset.
