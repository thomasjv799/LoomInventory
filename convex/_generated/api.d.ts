/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as access from "../access.js";
import type * as auth from "../auth.js";
import type * as bootstrap from "../bootstrap.js";
import type * as catalogue from "../catalogue.js";
import type * as domain_http from "../domain/http.js";
import type * as domain_idempotency from "../domain/idempotency.js";
import type * as domain_imports from "../domain/imports.js";
import type * as domain_seed from "../domain/seed.js";
import type * as domain_snapshot from "../domain/snapshot.js";
import type * as domain_stock from "../domain/stock.js";
import type * as domain_validation from "../domain/validation.js";
import type * as exports from "../exports.js";
import type * as http from "../http.js";
import type * as imports from "../imports.js";
import type * as inventory from "../inventory.js";
import type * as memberships from "../memberships.js";
import type * as operations from "../operations.js";
import type * as reportWorker from "../reportWorker.js";
import type * as reports from "../reports.js";
import type * as seed from "../seed.js";
import type * as settings from "../settings.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  access: typeof access;
  auth: typeof auth;
  bootstrap: typeof bootstrap;
  catalogue: typeof catalogue;
  "domain/http": typeof domain_http;
  "domain/idempotency": typeof domain_idempotency;
  "domain/imports": typeof domain_imports;
  "domain/seed": typeof domain_seed;
  "domain/snapshot": typeof domain_snapshot;
  "domain/stock": typeof domain_stock;
  "domain/validation": typeof domain_validation;
  exports: typeof exports;
  http: typeof http;
  imports: typeof imports;
  inventory: typeof inventory;
  memberships: typeof memberships;
  operations: typeof operations;
  reportWorker: typeof reportWorker;
  reports: typeof reports;
  seed: typeof seed;
  settings: typeof settings;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
};
