import type { MutationCtx } from "../_generated/server";
import type { AccessScope } from "../access";
import { fail } from "./validation";
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ":" + canonical(v))
        .join(",") +
      "}"
    );
  return JSON.stringify(value) ?? "null";
}
export async function withIdempotency<T>(
  ctx: MutationCtx,
  scope: AccessScope,
  operation: string,
  key: string,
  payload: unknown,
  execute: () => Promise<T>,
): Promise<T> {
  if (!key.trim() || key.length > 128)
    fail("INVALID_INPUT", "An idempotency key of 1–128 characters is required");
  const hash = canonical(payload);
  const previous = await ctx.db
    .query("idempotency")
    .withIndex("by_key", (q) =>
      q
        .eq("organizationId", scope.organizationId)
        .eq("operation", operation)
        .eq("key", key),
    )
    .unique();
  if (previous) {
    if (previous.hash !== hash)
      fail("CONFLICT", "Idempotency key reused with changed payload");
    return JSON.parse(previous.result) as T;
  }
  const result = await execute();
  await ctx.db.insert("idempotency", {
    organizationId: scope.organizationId,
    operation,
    key,
    hash,
    result: JSON.stringify(result),
  });
  await ctx.db.insert("auditEvents", {
    organizationId: scope.organizationId,
    actorId: scope.authUserId,
    operation,
    entityId: JSON.stringify(result),
    changes: "Validated operation",
    requestId: key,
    at: Date.now(),
  });
  await ctx.db.patch(scope.organizationId, {
    sourceWatermark: scope.organization.sourceWatermark + 1,
  });
  return result;
}
