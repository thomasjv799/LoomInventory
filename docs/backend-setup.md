# Convex backend setup

The implemented backend uses TypeScript on Convex and Better Auth with Google/Microsoft social sign-in. Next.js runs on Netlify. The earlier FastAPI/PostgreSQL proposal remains a reference; it is not another running service.

## Run locally

1. Install Node 24 and Python 3.10+, then run `npm ci`.
2. Copy `.env.example` to `.env.local`, keeping `NEXT_PUBLIC_DATA_MODE=demo` to review the original dashboard and `/login` without credentials. Run `npm run dev`.
3. For a database, run `npm run convex:dev`. Without a configured deployment, the current CLI supports anonymous local development; it generates real files in `convex/_generated/` and stores local state outside Git. Keep this process running.
4. Set Convex `DEPLOYMENT_ENV=development` explicitly (`npx convex env set DEPLOYMENT_ENV development`). Run `npm run seed:convex` to stage the committed synthetic normalized package. Repeating the command resumes the same local version/chunks. Run `npm run seed:convex -- --activate` explicitly to reconcile and activate; an existing ready version is preserved.
5. Configure `SITE_URL` and a strong `BETTER_AUTH_SECRET` in the Convex deployment. Set Google/Microsoft OAuth credentials there. Switch frontend mode to `convex`, fill all three public URLs and restart Next.js.
6. Sign in, then grant the resulting stable auth user ID through the deployment-owner-only `bootstrap:firstAdministrator` command with the explicit organization ID. New sign-ins have no inventory access by default. Subsequent membership changes use the administrator-only function.

The deployment owner can bootstrap the first signed-in administrator after activation:

```sh
npx convex run bootstrap:firstAdministrator '{"authUserId":"ACTUAL_AUTH_USER_ID","organizationId":"ACTUAL_ORGANIZATION_ID"}'
```

Use the user ID from the Better Auth component's user record, and the organization ID printed/retained by the explicit seed command. This internal command is unavailable to public API callers. No ID is derived from an email address.

Local stock and sales data are simulated. No seed command runs automatically during application startup or a build. `.convex/`, `.env.local` and deploy/provider secrets are ignored by Git.

## Add a new dress

Use **Add product** to enter the SKU, attributes, cost, suggested MRP, applicable sizes and optional image references. The style is created with zero stock. In fixture mode, additions persist in this browser and remain labelled demo data; in Convex mode, authorized catalogue changes persist in the database.

Receive production/opening stock through `operations.receiveStock`, providing organization, variant, location, bin, quantity, business date and a unique idempotency key. A later sale records its own transaction MRP and actual net line value, then deducts stock once. Suggested MRP is never substituted for actual selling price.

Google/Microsoft login is social sign-in; this implementation does not offer company-managed SAML connections, password login or public administrator registration. Memberships use auth user IDs, not email-domain rules.

## Data and import format

The eleven logical inputs remain in `data/inputs/`; the canonical normalized transport is in `data/normalized/`, with checksums, expected counts and dependency order. Catalogue/locations/bins, variants, transfers, ledger, receipts and financial/context records are loaded in that order. All references are remapped from source IDs into scoped Convex IDs. The ledger includes 900 opening rows plus 15,953 subsequent movements.

The snapshot import API accepts a complete normalized package, declaring all eleven contributing input types and an explicit opening cutoff. The source sheets must first be normalized to this documented transport; there is no direct XLSX/CSV uploader or arbitrary spreadsheet parser in this milestone. Keep store movements and receipt evidence alongside the eleven input exports rather than treating financial sheets as a second stock deduction.

Run `tsx scripts/import-convex.ts --cutoff=YYYY-MM-DD --directory=/path/to/normalized` with a temporary authenticated administrator `CONVEX_IMPORT_TOKEN`, public backend URL and `IMPORT_ORGANIZATION_ID`. It checks file hashes, stages chunks, validates counts/references and prints the batch ID. Add `--commit` explicitly to request reconciliation and activation. Do not log or commit the token.

The manifest must declare every normalized table, including zero counts for deliberately empty tables. Each chunk is capped at 100 rows and 256 KiB. Imports prepare an invisible dataset version. Ready publication atomically switches the organization pointer, remaps existing store grants by external location IDs and preserves membership/audit records. If operational data changes during preparation, activation conflicts and the current dataset stays intact; prepare a fresh snapshot. Rejected source references identify the source ID. Status and rejection endpoints are administrator-only.

## Backend surfaces

- Generated Convex functions are the primary browser API: memberships, catalogue, inventory, reports, settings, operations and imports.
- HTTP `/api/v1` adapters expose the same authorized functions. Next.js `/api/v1` proxies use the signed-in session's Convex token. Direct external requests require a valid Better Auth/Convex bearer token; there is no shared browser admin key.
- See [runtime API contract](api/convex-openapi.json) and [architecture](../convex/schema.ts). Document IDs identify API records; `externalId` preserves fixture/source identity for remapping and exports.
- Reports are asynchronous runs. Request preparation, wait for ready, then paginate/export one run. Revoked or narrowed access invalidates cached pages/exports; changed data/settings returns stale rather than mixing versions.

## Prototype limits and verification

Operational writes additionally fail closed if one variant/location exceeds 100 balance rows or 100 reservation rows; consolidate those records or implement complete transactional aggregates before lifting the limit.

Current report preparation and import reconciliation use indexed source pages of 100 rows, with a **50,000 total source-row guard** per snapshot job. The committed sample fits this bound. This is a prototype safety limit, not enterprise throughput evidence. Daily-sales and exposure tables are schema foundations; continuous incremental aggregate pipelines and larger-scale streaming workers are follow-up work. Activation additionally limits membership remapping to 100 users; exceeding the limit fails without publishing partial data.

The local seed reconciled to 30 products, 150 variants, 7,471 sales lines, 16,853 ledger rows, 9,823 physical units, 44 unreceived transit units and ₹35,519,868.20 net sales. This is simulated historical revenue, not The Loom's actual sales.

Unit tests use `convex-test` and explicitly simulated identities. Real Google/Microsoft callbacks, deployed cookie behavior, Netlify runtime and production load/restore tests require configured accounts/domain and remain deployment checks. Tests do not prove production SSO or enterprise readiness.
