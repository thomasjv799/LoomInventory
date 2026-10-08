import type { Doc } from "../_generated/dataModel";
import type { Dataset } from "../../lib/types";
import { tableMap } from "./seed";
export type BusinessTable = (typeof tableMap)[keyof typeof tableMap];
export type Snapshot = { [K in BusinessTable]: Doc<K>[] } & {
  stockBalances: Doc<"stockBalances">[];
};
export const snapshotTables = [
  ...Object.values(tableMap),
  "stockBalances",
] as const;
export function toDataset(input: Snapshot, asOf: string): Dataset {
  const loc = new Map(input.locations.map((r) => [r._id, r.externalId])),
    product = new Map(input.products.map((r) => [r._id, r.externalId])),
    variant = new Map(input.variants.map((r) => [r._id, r.externalId])),
    bins = new Map(input.bins.map((r) => [r._id, r.externalId])),
    movement = new Map(input.inventoryLedger.map((r) => [r._id, r.externalId])),
    orders = new Map(input.salesOrders.map((r) => [r._id, r]));
  const ledger = input.inventoryLedger.map((r) => ({
    id: r.externalId,
    variantId: variant.get(r.variantId)!,
    locationId: loc.get(r.locationId)!,
    binId: bins.get(r.binId)!,
    condition: r.condition,
    quantity: r.quantityDelta,
    date: r.effectiveAt,
    reason: r.reason,
    reference: r.sourceId,
  }));
  const sizes = input.forecastValues.map((r) => {
    const v = input.variants.find((v) => v._id === r.variantId)!;
    return {
      productId: product.get(v.productId)!,
      variantId: v.externalId,
      size: v.size,
      month: r.month,
      units: r.units,
      factor: r.factor,
      method: r.method,
    };
  });
  const forecasts = new Map<string, Dataset["forecasts"][number]>();
  for (const r of sizes) {
    const key = r.productId + r.month;
    const p = forecasts.get(key) || {
      productId: r.productId,
      month: r.month,
      units: 0,
      factor: r.factor,
      method: r.method,
    };
    p.units += r.units;
    forecasts.set(key, p);
  }
  return {
    asOf,
    historyStart: ledger.reduce(
      (date, r) => (r.date < date ? r.date : date),
      asOf,
    ),
    products: input.products.map((p) => {
      const images = input.productImages.filter((i) => i.productId === p._id);
      return {
        id: p.externalId,
        sku: p.sku,
        name: p.name,
        category: p.category,
        color: p.color,
        fabric: p.fabric,
        craft: p.craft,
        kurtaLength: p.kurtaLength,
        style: p.style,
        collection: p.collection,
        season: p.season,
        launchDate: p.launchDate,
        cost: p.costMinor,
        suggestedMrp: p.suggestedMrpMinor,
        image: images[0]?.url || "",
        secondaryImage: images[1]?.url || null,
        sourceProductUrl: images[0]?.sourceProductUrl || "",
        sizes: input.variants
          .filter((v) => v.productId === p._id)
          .map((v) => v.size),
        provenance: p.provenance,
      };
    }),
    variants: input.variants.map((v) => ({
      id: v.externalId,
      productId: product.get(v.productId)!,
      sku: v.sku,
      size: v.size,
    })),
    locations: input.locations.map((r) => ({
      id: r.externalId,
      name: r.name,
      city: r.city,
      type: r.type,
    })),
    bins: input.bins.map((r) => ({
      id: r.externalId,
      locationId: loc.get(r.locationId)!,
      name: r.name,
      excluded: r.excludedFromAvailability,
    })),
    openingInventory: ledger.filter((r) => r.reason === "Opening balance"),
    movements: ledger.filter((r) => r.reason !== "Opening balance"),
    balances: input.stockBalances.map((r) => ({
      variantId: variant.get(r.variantId)!,
      locationId: loc.get(r.locationId)!,
      binId: bins.get(r.binId)!,
      condition: r.condition,
      quantity: r.quantity,
    })),
    sales: input.salesLines
      .filter((r) => orders.has(r.orderId))
      .map((r) => {
        const order = orders.get(r.orderId)!,
          v = input.variants.find((v) => v._id === r.variantId)!;
        return {
          id: r.externalId,
          orderId: order.externalId,
          productId: product.get(v.productId)!,
          variantId: variant.get(r.variantId)!,
          locationId: loc.get(order.locationId)!,
          channel: order.channel,
          date: order.businessDate,
          quantity: r.quantity,
          mrp: r.transactionMrpMinor,
          netValue: r.netValueMinor,
          movementId: movement.get(r.linkedMovementId)!,
          dupattaAttached: r.matchingStatus === "with",
          matchingStatus: r.matchingStatus,
          ...(r.matchingDupattaId
            ? { matchingDupattaId: product.get(r.matchingDupattaId)! }
            : {}),
        };
      }),
    transfers: input.transfers.map((r) => ({
      id: r.externalId,
      variantId: variant.get(r.variantId)!,
      source: loc.get(r.sourceId)!,
      destination: loc.get(r.destinationId)!,
      dispatched: r.dispatched,
      received: r.received,
      inTransit: r.dispatched - r.received,
      dispatchDate: r.dispatchDate,
      receivedDate:
        input.transferReceipts.find((x) => x.transferId === r._id)
          ?.receiptDate ?? null,
      eta: r.eta,
      ownership: "Central",
    })),
    reservations: input.reservations.map((r) => ({
      variantId: variant.get(r.variantId)!,
      locationId: loc.get(r.locationId)!,
      quantity: r.quantity,
    })),
    matchingRelationships: input.matchingRelationships.map((r) => ({
      outfitId: product.get(r.outfitId)!,
      dupattaId: product.get(r.dupattaId)!,
      relationship: r.relationship,
      ratio: r.ratio,
    })),
    events: input.events.map((r) => ({
      id: r.externalId,
      name: r.name,
      start: r.start,
      end: r.end,
      kind: r.kind,
      multiplier: r.multiplier,
      ...(r.sourceUrl ? { sourceUrl: r.sourceUrl } : {}),
      ...(r.note ? { note: r.note } : {}),
    })),
    influencers: input.influencerActivity.map((r) => ({
      id: r.externalId,
      productId: product.get(r.productId)!,
      name: r.name,
      type: r.type,
      date: r.date,
      channel: r.channel,
      note: r.note,
    })),
    sizeForecasts: sizes,
    forecasts: [...forecasts.values()],
    scenarios: [],
    metadata: { synthetic: true, source: "Convex authorized snapshot" },
  };
}
