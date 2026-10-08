import { ConvexError } from "convex/values";
export function fail(code: string, message: string): never {
  throw new ConvexError({ code, message });
}
export function integer(value: number, name: string, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum)
    fail("INVALID_INPUT", `${name} must be a safe integer >= ${minimum}`);
}
export function validateSeedRow(table: string, row: Record<string, unknown>) {
  for (const [key, value] of Object.entries(row)) {
    if (/Minor$|_minor$/.test(key) && value !== null)
      integer(value as number, key);
    if (
      /quantity|quantityDelta|quantity_delta|^(units|dispatched_qty|received_qty)$/.test(
        key,
      )
    )
      integer(
        value as number,
        key,
        key.includes("Delta") || key.includes("_delta")
          ? -Number.MAX_SAFE_INTEGER
          : 0,
      );
  }
  return { valid: true as const, table };
}
export function checkChunk(rows: unknown[]) {
  if (
    rows.length > 100 ||
    new TextEncoder().encode(JSON.stringify(rows)).length > 256 * 1024
  )
    fail("INVALID_INPUT", "Chunk exceeds 100 rows or 256 KiB");
}
