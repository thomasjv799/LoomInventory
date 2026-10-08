# SDD ledger — plan: docs/superpowers/plans/2026-10-07-convex-backend-auth.md

Ruling: User's go-ahead after recommending Native is treated as approval to execute inline — avoids another process-only confirmation — cost if wrong: user preferred per-task independent reviews.
Ruling: Continue in existing feature checkout as approved spec requires existing branch/PR — no new worktree or main-branch edits — cost if wrong: less checkout isolation.
Pre-flight: Tasks 1→2→3 share DataModel/AccessScope; Tasks 3→4→5 share DTO/report provider; Tasks 1/2/6→7 share scoped ledger/version/idempotency; Task 8 adapts all functions. Consistent interfaces.
Task 1: started. Baseline 22/22 tests passing. Serena symbol overview unavailable (ValueError); use file reads as fallback.
Task 1: Ruling: Vitest 5 conflicts with Better Auth's supported optional peer; select Vitest 4.1.11 and exact Better Auth 1.6.33/component 0.12.5 — compatible official version range — cost if wrong: test-tool migration.
Task 1: Local Convex 1.46 backend generated actual component/schema types without cloud credentials. Seed validation/reference replay tests 3/3; Python contracts 20/20; typecheck passes. Full fixture parity/reconciliation still pending, do not mark complete yet.
Task 2: access/callback/mode tests RED then GREEN 8/8. Login UI and more role/location tests pending.
Task 2: Ruling: Better Auth 1.6.15 guide pin has a high-severity package advisory; keep component-supported 1.6.33 and cast only the official React provider AuthClient boundary, whose generic resolves useSession.data to never under current TS — runtime remains vendor bridge, not custom auth — cost if wrong: integration type mismatch needs live smoke validation.
Task 5: Ruling: Convex rejects hyphens in function-module filenames; use convex/reportWorker.ts rather than planned report-worker.ts — platform requirement — cost if wrong: documentation paths must follow rename.

Ruling: Report/import workers use capped server snapshots (50,000 source rows) instead of a continuous incremental dailySales/exposure pipeline — sufficient for the prototype and rejects oversize history — cost if wrong: enterprise throughput requires a later worker redesign.
Ruling: API references use scoped Convex document IDs with preserved external business IDs — follows generated native API integration — cost if wrong: future clients require external-ID resolution/migration.
Verification: full normalized seed staged/replayed/activated locally: 30 products, 150 variants, 7,471 sales, 16,853 ledger rows, 9,823 physical, 44 transit, 3,551,986,820 paise net value. No real OAuth/provider/cloud smoke test claimed.
Verification: stock cutoff/bin release regression RED→GREEN; competing transfer and partial receipt checks pass; revoked-grant report/export checks pass. Full suite 54/54 before final UI/docs changes.

Tasks 1–8: source implementation assembled as one integrated milestone because generated schema/auth/provider/report interfaces are interdependent. Scope deviations are ledgered above; live credential-dependent acceptance stays pending rather than represented as completed. Reconciliation, authorization, operations, import preflight and HTTP tests pass; current suite 58/58, Python 20/20, clean install and both mode builds pass. Task 5 incremental aggregate work is explicitly deferred by ruling, not claimed complete.

Final review: independent gpt-6-astra review of whole branch (focused new backend range 6cba78d..397645e) found six Important issues, no Critical issues or deferred minors.
Final: fixed incomplete snapshot manifests — complete-snapshot imports reject omitted manifest tables RED→GREEN, suite 69/69.
Final: fixed retry publication/stale failure state — publication retries and stale failures cannot downgrade the active version RED→GREEN; batch activation/completion now atomic, suite 69/69.
Final: fixed transfer receipt evidence — five receipt variant/destination/quantity/reuse/total regressions RED→GREEN, suite 69/69; full local dataset reconciles unchanged.
Final: fixed truncated reservations/balance queries — reservation overflow and duplicate-balance regressions RED→GREEN; operations fail closed at explicit caps, suite 69/69.
Final: fixed catalogue drawer lookup beyond page one — authorized external-ID resolver regression RED→GREEN, source links use resolver fallback and complete report facets, suite 69/69.
Final: fixed filtered size mix — all-size cohort denominator regression RED→GREEN, suite 69/69.
Final verification: TypeScript passed; 69 Vitest and 22 Python checks passed after fix pass. Both-mode production builds and credential-free proxy/fixture checks recorded in QA. No live SSO or production capacity claim.
