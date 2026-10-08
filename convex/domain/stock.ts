import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { scoped, type AccessScope } from "../access";
import { fail, integer } from "./validation";
export type StockInput = {
  variantId: Id<"variants">;
  locationId: Id<"locations">;
  binId: Id<"bins">;
  date: string;
  quantity: number;
};
export async function stockEntities(
  ctx: MutationCtx,
  scope: AccessScope,
  input: StockInput,
) {
  integer(input.quantity, "Quantity", 1);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(input.date) ||
    !Number.isFinite(Date.parse(input.date)) ||
    new Date(input.date).toISOString().slice(0, 10) !== input.date
  )
    fail("INVALID_INPUT", "Invalid stock date");
  const variant = scoped(await ctx.db.get(input.variantId), scope),
    bin = scoped(await ctx.db.get(input.binId), scope);
  if (bin.locationId !== input.locationId)
    fail("INVALID_INPUT", "Bin is at a different location");
  const product = scoped(await ctx.db.get(variant.productId), scope);
  if (product.archived || !variant.active)
    fail("INVALID_INPUT", "Style is archived");
  return { variant, bin, product };
}
export async function delta(
  ctx: MutationCtx,
  scope: AccessScope,
  input: StockInput,
  condition: "sellable" | "quarantine",
  quantityDelta: number,
  reason: string,
  eventGroupId: string,
) {
  const { bin } = await stockEntities(ctx, scope, input);
  const balances = await ctx.db
    .query("stockBalances")
    .withIndex("by_stock", (q) =>
      q
        .eq("organizationId", scope.organizationId)
        .eq("datasetVersionId", scope.datasetVersionId!)
        .eq("variantId", input.variantId)
        .eq("locationId", input.locationId),
    )
    .take(101);
  if (balances.length > 100)
    fail(
      "CONFLICT",
      "Stock balance limit exceeded; consolidate bins before this operation",
    );
  const balance = balances.find(
    (b) => b.binId === input.binId && b.condition === condition,
  );
  if (quantityDelta < 0 && (!balance || balance.quantity + quantityDelta < 0))
    fail("INSUFFICIENT_STOCK", "Not enough stock in this bin");
  if (quantityDelta < 0 && condition === "sellable") {
    if (bin.excludedFromAvailability && reason !== "Bin move")
      fail("INVALID_INPUT", "Dispatch center stock is unavailable");
    let sellable = 0;
    for (const b of balances) {
      const bb = await ctx.db.get(b.binId);
      if (b.condition === "sellable" && !bb?.excludedFromAvailability)
        sellable += b.quantity;
    }
    const reservations = await ctx.db
      .query("reservations")
      .withIndex("by_stock", (q) =>
        q
          .eq("organizationId", scope.organizationId)
          .eq("datasetVersionId", scope.datasetVersionId!)
          .eq("variantId", input.variantId)
          .eq("locationId", input.locationId),
      )
      .take(101);
    if (reservations.length > 100)
      fail(
        "CONFLICT",
        "Reservation limit exceeded; consolidate reservations before this operation",
      );
    if (
      !bin.excludedFromAvailability &&
      sellable -
        reservations.reduce((n, r) => n + r.quantity, 0) +
        quantityDelta <
        0
    )
      fail("INSUFFICIENT_STOCK", "Stock is reserved or unavailable");
  }
  const common = {
    organizationId: scope.organizationId,
    datasetVersionId: scope.datasetVersionId!,
  };
  const externalId = "M-" + crypto.randomUUID();
  const movementId = await ctx.db.insert("inventoryLedger", {
    ...common,
    externalId,
    eventGroupId,
    variantId: input.variantId,
    locationId: input.locationId,
    binId: input.binId,
    condition,
    quantityDelta,
    effectiveAt: input.date,
    recordedAt: Date.now(),
    reason,
    sourceId: eventGroupId,
    actorId: scope.authUserId,
  });
  if (balance)
    await ctx.db.patch(balance._id, {
      quantity: balance.quantity + quantityDelta,
      watermark: scope.organization.sourceWatermark + 1,
    });
  else
    await ctx.db.insert("stockBalances", {
      ...common,
      externalId: `${input.variantId}:${input.locationId}:${input.binId}:${condition}`,
      variantId: input.variantId,
      locationId: input.locationId,
      binId: input.binId,
      condition,
      quantity: quantityDelta,
      watermark: scope.organization.sourceWatermark + 1,
    });
  const version = await ctx.db.get(scope.datasetVersionId!);
  const cutoff = new Date(Date.parse(input.date) + 86400000)
    .toISOString()
    .slice(0, 10);
  if (version && cutoff > version.asOf)
    await ctx.db.patch(version._id, { asOf: cutoff });
  return movementId;
}
