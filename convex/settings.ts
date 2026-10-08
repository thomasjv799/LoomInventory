import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { settingsValidator } from "./schema";
import { defaults } from "../lib/analytics";
import { requireAccess } from "./access";
import { withIdempotency } from "./domain/idempotency";
import { fail, integer } from "./domain/validation";
export const get = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireAccess(ctx, { ...args, capability: "read" });
    const s = await ctx.db
      .query("organizationSettings")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .unique();
    return s
      ? { values: s.values, version: s.version }
      : { values: defaults, version: 0 };
  },
});
export const update = mutation({
  args: {
    organizationId: v.id("organizations"),
    values: settingsValidator,
    expectedVersion: v.number(),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const scope = await requireAccess(ctx, {
      organizationId: args.organizationId,
      capability: "admin",
    });
    const s = args.values;
    for (const [key, value] of Object.entries(s))
      if (typeof value === "number" && !Number.isFinite(value))
        fail("INVALID_INPUT", key + " must be finite");
    for (const key of [
      "cover",
      "peakCover",
      "minimum",
      "deadDays",
      "freshDays",
    ] as const)
      integer(s[key], key, 1);
    if (
      s.peakCover < s.cover ||
      s.fast <= s.slow ||
      s.slow < 0 ||
      s.hit <= s.average ||
      s.average < 0 ||
      s.hit > 100 ||
      s.spike < 0 ||
      s.drop < 0 ||
      s.drop > 100 ||
      !s.coreSizes.length ||
      new Set(s.coreSizes).size !== s.coreSizes.length ||
      s.coreSizes.some(
        (x) =>
          !["XS", "S", "M", "L", "XL", "XXL", "3XL", "Free size"].includes(x),
      )
    )
      fail("INVALID_INPUT", "Invalid thresholds or required sizes");
    return withIdempotency(
      ctx,
      scope,
      "settings.update",
      args.idempotencyKey,
      args,
      async () => {
        const prev = await ctx.db
          .query("organizationSettings")
          .withIndex("by_org", (q) =>
            q.eq("organizationId", scope.organizationId),
          )
          .unique();
        if ((prev?.version ?? 0) !== args.expectedVersion)
          fail("CONFLICT", "Stale settings version");
        const version = args.expectedVersion + 1;
        if (prev) await ctx.db.patch(prev._id, { values: s, version });
        else
          await ctx.db.insert("organizationSettings", {
            organizationId: scope.organizationId,
            values: s,
            version,
          });
        return { values: s, version };
      },
    );
  },
});
