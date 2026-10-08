# Netlify and Convex deployment runbook

Production is deployed at https://loominventory.netlify.app with Convex deployment `animated-badger-72` in Sydney. Initial synthetic data was reconciled and activated on 8 October 2026; the owner-provisioned administrator has access to all six locations. Initial-account environment variables were removed and `ALLOW_SYNTHETIC_SEED=false` restored. See [QA record](QA.md) for verification and remaining checks. Deployment keys and account passwords are not committed.

## Configure the environments

Public deployments require `NEXT_PUBLIC_DATA_MODE=convex`; Netlify fixture-mode builds are rejected. Provision an initial email/password account through the owner-only procedure in [backend setup](backend-setup.md#create-the-initial-password-account). Public registration and the login demo link are disabled. Production credentials are distinct from the private local review account. Database-backed Better Auth rate limiting applies to authentication requests.

Use separate Convex development, preview and production deployments. Use Netlify's supported Next.js runtime; keep the authentication/API server routes enabled. Do not use static export. `netlify.toml` runs the official Convex deploy-and-build pattern and explicitly supplies `NEXT_PUBLIC_CONVEX_URL` to the frontend build.

In **Convex**, configure `SITE_URL`, `BETTER_AUTH_SECRET` (at least 32 random characters), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, optional `MICROSOFT_TENANT_ID`, and `DEPLOYMENT_ENV`. Keep `ALLOW_SYNTHETIC_SEED=false` for production unless explicitly loading an isolated demonstration. Never put provider secrets into public variables.

In **Netlify**, configure `NEXT_PUBLIC_DATA_MODE=convex`, `NEXT_PUBLIC_CONVEX_SITE_URL` (the HTTP-actions `.site` address), `NEXT_PUBLIC_SITE_URL` (chosen frontend origin), and the context-specific `CONVEX_DEPLOY_KEY`. The build command supplies the `.cloud` address as `NEXT_PUBLIC_CONVEX_URL`. Production expects a `prod:` key; deploy/branch previews expect a distinct `preview:` key. Do not let preview contexts inherit the production key. Do not expose deployment keys through `NEXT_PUBLIC_` names.

Register OAuth redirect URIs in both providers:

- Local: `http://127.0.0.1:3000/api/auth/callback/google` and `/api/auth/callback/microsoft`, if that is the chosen local origin.
- Hosted: `https://YOUR-CONFIGURED-DOMAIN/api/auth/callback/google` and `/api/auth/callback/microsoft`.

Use the exact same origin in provider configuration, Convex `SITE_URL` and frontend site URL. Choose Microsoft's tenant policy deliberately: `common` permits the supported broad account set; a tenant ID restricts sign-in to that tenant. Sign-in still grants no inventory membership automatically.

Arbitrary Netlify preview domains are not automatically accepted OAuth callback/trusted origins. Use an explicitly configured preview origin or review a fixture build locally. Missing hosted configuration fails closed. Authenticated builds remove `public/mock-data.json`; a later demo build restores the committed synthetic file.

## Release sequence

1. Configure the chosen Convex project and secrets, generate types against it and run the checks in CI.
2. Create the Netlify site from this repository, set its base to the repository root and configure secrets by context.
3. Review an isolated preview. Load demo data only by an explicit seed/import command; builds never reset the database.
4. Sign in with a real provider account. Use its stable auth user ID for the internal first-administrator bootstrap. Review permitted locations and costs/network capabilities.
5. Smoke-test pending membership, logout, denied store/network access, product creation with zero stock, receipt, sale replay, simultaneous dispatch, partial receipt, QC, settings conflicts, scoped CSV and report readiness.
6. Publish production only after these checks and the user's release approval. This source milestone does not authorize a public release.

## Recovery and monitoring

For a frontend regression, restore a previous Netlify release and confirm its function/schema compatibility. For backend code, deploy the reviewed prior commit to the correct environment; code rollback is not a data rollback. Retain immutable ledger/audit history and old dataset versions. A dataset rollback must reconcile the desired version against subsequent operational writes and migrate location grants; do not simply repoint an old version and discard newer transactions.

Configure platform log/error monitoring, database exports/backups and restore drills before production. Alert on failed import/report jobs, repeated permission failures, stock reconciliation discrepancies and stale reports. The prototype reports asynchronous failures visibly but does not provide a production incident/backup service or complete warehouse-operation UI.

## Commands and evidence

`npm run typecheck`, `npm test`, `npm run check:data`, `npm run check:environment`, and `npm run build` validate the credential-independent source. `npm run convex:dev` runs the local backend. `npm run seed:convex -- --activate` explicitly reconciles/activates the staged local fixture.

Real SSO, deployed Next.js proxy cookies, cloud concurrency, capacity and recovery remain unverified until the corresponding isolated cloud smoke tests are run. Review the [backend setup guide](backend-setup.md) for prototype row/membership limits.
