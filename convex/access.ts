import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Id, Doc } from "./_generated/dataModel";
import { fail } from "./domain/validation";
export type Capability = "read" | "network" | "catalogue" | "stock" | "admin";
export async function identity(ctx: Pick<QueryCtx, "auth">) {
  const user = await ctx.auth.getUserIdentity();
  if (!user) fail("UNAUTHENTICATED", "Sign in required");
  return user;
}
export async function requireAccess(
  ctx: QueryCtx | MutationCtx,
  input: {
    organizationId: Id<"organizations">;
    capability: Capability;
    locationIds?: Id<"locations">[];
  },
) {
  const user = await identity(ctx);
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_user", (q) =>
      q
        .eq("authUserId", user.subject)
        .eq("organizationId", input.organizationId),
    )
    .unique();
  if (!membership?.active) fail("FORBIDDEN", "Access is not granted");
  const role = membership.role;
  if (
    (input.capability === "admin" && role !== "administrator") ||
    (input.capability === "catalogue" &&
      !["administrator", "merchandiser"].includes(role)) ||
    (input.capability === "stock" &&
      !["administrator", "operator"].includes(role)) ||
    (input.capability === "network" && !membership.networkRead)
  )
    fail("FORBIDDEN", "This operation is not permitted");
  const organization = await ctx.db.get(input.organizationId);
  if (!organization) fail("NOT_FOUND", "Organization not found");
  for (const id of input.locationIds || []) {
    const location = await ctx.db.get(id);
    if (
      !location ||
      location.organizationId !== organization._id ||
      location.datasetVersionId !== organization.activeDatasetVersionId ||
      !membership.allowedLocationIds.includes(id)
    )
      fail("FORBIDDEN", "Location is not permitted");
  }
  return {
    authUserId: user.subject,
    organizationId: organization._id,
    organization,
    allowedLocationIds: membership.allowedLocationIds,
    costRead: membership.costRead,
    networkRead: membership.networkRead,
    membership,
    datasetVersionId: organization.activeDatasetVersionId,
  };
}
export type AccessScope = Awaited<ReturnType<typeof requireAccess>>;
export function scoped<
  T extends {
    organizationId: Id<"organizations">;
    datasetVersionId: Id<"datasetVersions">;
  },
>(record: T | null, scope: AccessScope): T {
  if (
    !record ||
    record.organizationId !== scope.organizationId ||
    record.datasetVersionId !== scope.datasetVersionId
  )
    fail("NOT_FOUND", "Record not found");
  return record;
}
