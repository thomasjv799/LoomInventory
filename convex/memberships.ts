import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { identity, requireAccess } from "./access";
import { fail } from "./domain/validation";
import { withIdempotency } from "./domain/idempotency";
export const me = query({
  args: {},
  handler: async (ctx) => {
    const user = await identity(ctx);
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("authUserId", user.subject))
      .take(100);
    return {
      user: { id: user.subject, name: user.name || "Inventory user" },
      memberships: await Promise.all(
        memberships
          .filter((m) => m.active)
          .map(async (m) => ({
            ...m,
            organization: await ctx.db.get(m.organizationId),
          })),
      ),
    };
  },
});
export const organizations = me;
export const locations = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const scope = await requireAccess(ctx, { ...args, capability: "read" });
    if (!scope.datasetVersionId) return [];
    return (
      await ctx.db
        .query("locations")
        .withIndex("by_external", (q) =>
          q
            .eq("organizationId", scope.organizationId)
            .eq("datasetVersionId", scope.datasetVersionId!),
        )
        .take(100)
    ).filter((l) => scope.allowedLocationIds.includes(l._id));
  },
});
export const set = mutation({
  args: {
    organizationId: v.id("organizations"),
    authUserId: v.string(),
    role: v.union(
      v.literal("viewer"),
      v.literal("merchandiser"),
      v.literal("operator"),
      v.literal("administrator"),
    ),
    allowedLocationIds: v.array(v.id("locations")),
    active: v.boolean(),
    costRead: v.boolean(),
    networkRead: v.boolean(),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const scope = await requireAccess(ctx, {
      organizationId: args.organizationId,
      capability: "admin",
    });
    for (const id of args.allowedLocationIds) {
      const l = await ctx.db.get(id);
      if (
        !l ||
        l.organizationId !== scope.organizationId ||
        l.datasetVersionId !== scope.datasetVersionId
      )
        fail("INVALID_INPUT", "Invalid location grant");
    }
    return withIdempotency(
      ctx,
      scope,
      "memberships.set",
      args.idempotencyKey,
      args,
      async () => {
        const { idempotencyKey, ...values } = args;
        const prev = await ctx.db
          .query("memberships")
          .withIndex("by_user", (q) =>
            q
              .eq("authUserId", args.authUserId)
              .eq("organizationId", args.organizationId),
          )
          .unique();
        const id = prev ? prev._id : await ctx.db.insert("memberships", values);
        if (prev) await ctx.db.patch(id, values);
        await ctx.db.insert("auditEvents", {
          organizationId: scope.organizationId,
          actorId: scope.authUserId,
          operation: "membership.set",
          entityId: id,
          changes: JSON.stringify({ role: args.role, active: args.active }),
          requestId: crypto.randomUUID(),
          at: Date.now(),
        });
        return id;
      },
    );
  },
});
