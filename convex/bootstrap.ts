import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { fail } from "./domain/validation";
export const firstAdministrator = internalMutation({
  args: { authUserId: v.string(), organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    if (!args.authUserId.trim())
      fail("INVALID_INPUT", "Explicit auth user ID required");
    const existing = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) =>
        q
          .eq("authUserId", args.authUserId)
          .eq("organizationId", args.organizationId),
      )
      .unique();
    if (existing) return existing._id;
    const org = await ctx.db.get(args.organizationId);
    if (!org?.activeDatasetVersionId)
      fail("INVALID_INPUT", "Activate the dataset first");
    const locations = await ctx.db
      .query("locations")
      .withIndex("by_external", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("datasetVersionId", org.activeDatasetVersionId!),
      )
      .take(100);
    const id = await ctx.db.insert("memberships", {
      ...args,
      role: "administrator",
      allowedLocationIds: locations.map((l) => l._id),
      active: true,
      costRead: true,
      networkRead: true,
    });
    await ctx.db.insert("auditEvents", {
      organizationId: args.organizationId,
      actorId: "deployment-owner",
      operation: "bootstrap",
      entityId: id,
      changes: "Explicit administrator bootstrap",
      requestId: crypto.randomUUID(),
      at: Date.now(),
    });
    return id;
  },
});
