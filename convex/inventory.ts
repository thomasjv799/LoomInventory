import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireAccess, scoped } from "./access";
import { integer, fail } from "./domain/validation";
import { validateFilters } from "../lib/contracts";
export const list = query({
  args: {
    organizationId: v.id("organizations"),
    locationId: v.id("locations"),
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const scope = await requireAccess(ctx, {
      organizationId: args.organizationId,
      capability: "read",
      locationIds: [args.locationId],
    });
    const limit = args.limit ?? 25;
    integer(limit, "Limit", 1);
    if (limit > 100) fail("INVALID_INPUT", "Maximum limit is 100");
    const result = await ctx.db
      .query("stockBalances")
      .withIndex("by_location", (q) =>
        q
          .eq("organizationId", scope.organizationId)
          .eq("datasetVersionId", scope.datasetVersionId!)
          .eq("locationId", args.locationId),
      )
      .paginate({ numItems: limit, cursor: args.cursor ?? null });
    return {
      data: await Promise.all(
        result.page.map(async (b) => {
          const bin = await ctx.db.get(b.binId),
            variant = await ctx.db.get(b.variantId);
          return {
            ...b,
            size: variant?.size,
            sku: variant?.sku,
            excludedFromAvailability: bin?.excludedFromAvailability ?? true,
          };
        }),
      ),
      nextCursor: result.isDone ? null : result.continueCursor,
    };
  },
});
export const movements = query({
  args: {
    organizationId: v.id("organizations"),
    variantId: v.id("variants"),
    locationId: v.id("locations"),
    from: v.optional(v.string()),
    to: v.optional(v.string()),
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const scope = await requireAccess(ctx, {
      organizationId: args.organizationId,
      capability: "read",
      locationIds: [args.locationId],
    });
    scoped(await ctx.db.get(args.variantId), scope);
    const limit = args.limit ?? 25;
    integer(limit, "Limit", 1);
    if (limit > 100) fail("INVALID_INPUT", "Maximum limit is 100");
    validateFilters({
      ...(args.from ? { from: args.from } : {}),
      ...(args.to ? { to: args.to } : {}),
    });
    const page = await ctx.db
      .query("inventoryLedger")
      .withIndex("by_variant_location", (q) =>
        q
          .eq("organizationId", scope.organizationId)
          .eq("datasetVersionId", scope.datasetVersionId!)
          .eq("variantId", args.variantId)
          .eq("locationId", args.locationId),
      )
      .filter((q) =>
        q.and(
          q.gte(q.field("effectiveAt"), args.from ?? "0000-01-01"),
          q.lte(q.field("effectiveAt"), args.to ?? "9999-12-31"),
        ),
      )
      .order("desc")
      .paginate({ numItems: limit, cursor: args.cursor ?? null });
    return {
      data: page.page,
      nextCursor: page.isDone ? null : page.continueCursor,
    };
  },
});
