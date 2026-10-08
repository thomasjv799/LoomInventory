import { mutation } from "./_generated/server";
import { components } from "./_generated/api";
import { authComponent } from "./auth";
import { identity } from "./access";
import { fail } from "./domain/validation";

// Public Google access is explicitly limited to the configured synthetic workspace.
export const join = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await identity(ctx);
    const configured = process.env.GOOGLE_OPEN_ACCESS_ORGANIZATION_ID;
    if (!configured) return false;
    const organizationId = ctx.db.normalizeId("organizations", configured);
    if (!organizationId)
      fail("INVALID_INPUT", "Google workspace is not configured");
    const organization = await ctx.db.get(organizationId!);
    if (!organization?.synthetic || !organization.activeDatasetVersionId)
      fail(
        "FORBIDDEN",
        "Public Google access requires an active demo workspace",
      );
    const existing = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) =>
        q.eq("authUserId", user.subject).eq("organizationId", organizationId!),
      )
      .unique();
    // Never upgrade permissions or reactivate a revoked membership.
    if (existing) return existing.active;
    const profile = await authComponent.getAuthUser(ctx);
    if (!profile.emailVerified) return false;
    const google = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "account",
      where: [
        { field: "providerId", value: "google" },
        { field: "userId", value: user.subject },
      ],
      select: ["_id"],
    });
    if (!google) return false;
    const locations = await ctx.db
      .query("locations")
      .withIndex("by_external", (q) =>
        q
          .eq("organizationId", organizationId!)
          .eq("datasetVersionId", organization.activeDatasetVersionId!),
      )
      .take(101);
    if (locations.length > 100)
      fail("INVALID_INPUT", "Demo location limit exceeded");
    const membershipId = await ctx.db.insert("memberships", {
      organizationId: organizationId!,
      authUserId: user.subject,
      role: "viewer",
      active: true,
      costRead: false,
      networkRead: true,
      allowedLocationIds: locations
        .filter((location) => location.active)
        .map((location) => location._id),
    });
    await ctx.db.insert("auditEvents", {
      organizationId: organizationId!,
      actorId: user.subject,
      operation: "membership.googleJoin",
      entityId: membershipId,
      changes: "Google sign-in: viewer access to synthetic demo",
      requestId: crypto.randomUUID(),
      at: Date.now(),
    });
    return true;
  },
});
