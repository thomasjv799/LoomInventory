import {
  query,
  mutation,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { requireAccess, identity, type AccessScope } from "./access";
import { fail, integer } from "./domain/validation";
import { canonical } from "./domain/idempotency";
import { validateFilters } from "../lib/contracts";
import {
  reportNames,
  type PreparedReport,
  type ReportEnvelope,
} from "../lib/report-types";
import { filtersForReport } from "../lib/report-filters";
import { defaults } from "../lib/analytics";
import { snapshotTables } from "./domain/snapshot";
export const scopeFingerprint = (s: AccessScope) =>
  canonical({
    locations: s.allowedLocationIds.slice().sort(),
    network: s.networkRead,
    cost: s.costRead,
    active: s.membership.active,
    role: s.membership.role,
  });
export const request = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    filters: v.string(),
    sort: v.optional(v.string()),
    direction: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    layout: v.optional(v.union(v.literal("table"), v.literal("matrix"))),
  },
  handler: async (ctx, args) => {
    if (!reportNames.includes(args.name as (typeof reportNames)[number]))
      fail("INVALID_INPUT", "Unknown report");
    const sortFields = [
      "id",
      "name",
      "size",
      "location",
      "available",
      "physical",
      "excluded",
      "quarantine",
      "reserved",
      "inTransit",
      "sold",
      "stockoutDays",
      "status",
      "priority",
      "fabric",
      "craft",
      "color",
      "units",
      "netValueMinor",
      "actualUnitPriceMinor",
      "unpricedUnits",
      "change7",
      "change10",
      "trend",
      "from",
      "to",
      "quantity",
      "incoming",
      "target",
      "leadDays",
      "reason",
      "healthy",
      "missing",
      "sellthrough",
      "classification",
      "fresh",
      "observedLeadDays",
      "observedRatioPercent",
      "suggestedUnits",
      "evidence",
      "month",
      "factor",
      "method",
      "creator",
      "date",
      "channel",
      "note",
      "dupatta",
      "withUnits",
      "without",
      "unknown",
      "attachment",
      "outfits",
      "matched",
      "shortage",
      "coverage",
    ];
    if (
      args.sort &&
      !sortFields.includes(args.sort) &&
      !(
        args.name === "inventory" &&
        args.layout === "matrix" &&
        /^size_(XS|S|M|L|XL|XXL|3XL|Free size)$/.test(args.sort)
      )
    )
      fail("INVALID_INPUT", "Unsupported report sort");
    const network = [
      "rotation",
      "replenishment",
      "ho-shortages",
      "forecasts",
    ].includes(args.name);
    const s = await requireAccess(ctx, {
      organizationId: args.organizationId,
      capability: network ? "network" : "read",
    });
    if (!s.datasetVersionId) fail("CONFLICT", "No active dataset");
    let filters;
    try {
      filters = validateFilters(JSON.parse(args.filters));
    } catch {
      fail("INVALID_INPUT", "Invalid report filters");
    }
    const locs = await ctx.db
      .query("locations")
      .withIndex("by_external", (q) =>
        q
          .eq("organizationId", s.organizationId)
          .eq("datasetVersionId", s.datasetVersionId!),
      )
      .take(100);
    if (network && locs.some((l) => !s.allowedLocationIds.includes(l._id)))
      fail("FORBIDDEN", "Network reports require all location grants");
    if (
      filters.location &&
      !locs.some(
        (l) =>
          l.externalId === filters.location &&
          s.allowedLocationIds.includes(l._id),
      )
    )
      fail("FORBIDDEN", "Location is not permitted");
    const settings = await ctx.db
      .query("organizationSettings")
      .withIndex("by_org", (q) => q.eq("organizationId", s.organizationId))
      .unique();
    const runId = await ctx.db.insert("reportRuns", {
      organizationId: s.organizationId,
      datasetVersionId: s.datasetVersionId,
      authUserId: s.authUserId,
      scopeHash: scopeFingerprint(s),
      name: args.name,
      filters: JSON.stringify(filters),
      sourceWatermark: s.organization.sourceWatermark,
      settingsVersion: settings?.version ?? 0,
      algorithmVersion: "demo-v1",
      status: "pending",
      totals: "{}",
      expiresAt: Date.now() + 15 * 60 * 1000,
      checkpoint: JSON.stringify({
        sort: args.sort ?? "id",
        direction: args.direction ?? "asc",
        layout: args.layout ?? "table",
      }),
    });
    await ctx.scheduler.runAfter(0, internal.reportWorker.prepare, { runId });
    return { runId, status: "pending" };
  },
});
export const page = query({
  args: {
    organizationId: v.id("organizations"),
    runId: v.id("reportRuns"),
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ status: string; report: ReportEnvelope | null }> => {
    const s = await requireAccess(ctx, {
        organizationId: args.organizationId,
        capability: "read",
      }),
      run = await ctx.db.get(args.runId);
    if (
      !run ||
      run.organizationId !== s.organizationId ||
      run.authUserId !== s.authUserId ||
      run.scopeHash !== scopeFingerprint(s)
    )
      fail("FORBIDDEN", "Report access changed");
    const settings = await ctx.db
      .query("organizationSettings")
      .withIndex("by_org", (q) => q.eq("organizationId", s.organizationId))
      .unique();
    if (
      run.datasetVersionId !== s.datasetVersionId ||
      run.sourceWatermark !== s.organization.sourceWatermark ||
      run.settingsVersion !== (settings?.version ?? 0) ||
      run.expiresAt < Date.now()
    )
      return { status: "stale", report: null };
    if (run.status !== "ready") return { status: run.status, report: null };
    const limit = args.limit ?? 25;
    integer(limit, "Limit", 1);
    if (limit > 100) fail("INVALID_INPUT", "Maximum limit is 100");
    const page = await ctx.db
      .query("reportRows")
      .withIndex("by_run", (q) => q.eq("runId", run._id))
      .paginate({ numItems: limit, cursor: args.cursor ?? null });
    const prepared = JSON.parse(run.totals) as Omit<PreparedReport, "rows">;
    const version = await ctx.db.get(run.datasetVersionId);
    return {
      status: "ready",
      report: {
        ...prepared,
        data: page.page.map((r) => JSON.parse(r.payload)),
        meta: {
          asOf: version!.asOf,
          synthetic: s.organization.synthetic,
          currency: "INR",
          timezone: "Asia/Kolkata",
          sourceWatermark: run.sourceWatermark,
          settingsVersion: run.settingsVersion,
          algorithmVersion: run.algorithmVersion,
          appliedFilters: filtersForReport(
            run.name as (typeof reportNames)[number],
            JSON.parse(run.filters),
          ).applied,
          ignoredFilters: filtersForReport(
            run.name as (typeof reportNames)[number],
            JSON.parse(run.filters),
          ).ignored,
          nextCursor: page.isDone ? null : page.continueCursor,
          requestId: run._id,
        },
      },
    };
  },
});
export const sourcePage = internalQuery({
  args: {
    runId: v.id("reportRuns"),
    table: v.string(),
    cursor: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) fail("NOT_FOUND", "Run not found");
    if (!snapshotTables.includes(args.table as (typeof snapshotTables)[number]))
      fail("INVALID_INPUT", "Unknown source table");
    const org = await ctx.db.get(run.organizationId);
    if (
      org?.sourceWatermark !== run.sourceWatermark ||
      org.activeDatasetVersionId !== run.datasetVersionId
    )
      fail("CONFLICT", "Source changed");
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) =>
        q
          .eq("authUserId", run.authUserId)
          .eq("organizationId", run.organizationId),
      )
      .unique();
    if (!membership?.active) fail("FORBIDDEN", "Access revoked");
    const page = await ctx.db
      .query(args.table as (typeof snapshotTables)[number])
      .withIndex("by_external", (q) =>
        q
          .eq("organizationId", run.organizationId)
          .eq("datasetVersionId", run.datasetVersionId),
      )
      .paginate({ numItems: 100, cursor: args.cursor });
    return page;
  },
});
export const preparation = internalQuery({
  args: { runId: v.id("reportRuns") },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) fail("NOT_FOUND", "Run not found");
    const version = await ctx.db.get(run.datasetVersionId);
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) =>
        q
          .eq("authUserId", run.authUserId)
          .eq("organizationId", run.organizationId),
      )
      .unique();
    if (!membership?.active) fail("FORBIDDEN", "Access revoked");
    const settings = await ctx.db
      .query("organizationSettings")
      .withIndex("by_org", (q) => q.eq("organizationId", run.organizationId))
      .unique();
    return { run, version, membership, settings: settings?.values ?? defaults };
  },
});
export const putRows = internalMutation({
  args: {
    runId: v.id("reportRuns"),
    offset: v.number(),
    rows: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.rows.length > 100) fail("INVALID_INPUT", "Too many report rows");
    for (const [i, payload] of args.rows.entries()) {
      const position = args.offset + i;
      const existing = await ctx.db
        .query("reportRows")
        .withIndex("by_run", (q) =>
          q.eq("runId", args.runId).eq("position", position),
        )
        .unique();
      if (existing) await ctx.db.patch(existing._id, { payload });
      else
        await ctx.db.insert("reportRows", {
          runId: args.runId,
          position,
          payload,
        });
    }
  },
});
export const publish = internalMutation({
  args: { runId: v.id("reportRuns"), totals: v.string(), status: v.string() },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) fail("NOT_FOUND", "Run not found");
    const org = await ctx.db.get(run.organizationId);
    const unchanged =
      org?.sourceWatermark === run.sourceWatermark &&
      org.activeDatasetVersionId === run.datasetVersionId;
    await ctx.db.patch(run._id, {
      totals: args.totals,
      status: unchanged ? args.status : "stale",
      checkpoint: args.status,
    });
  },
});
