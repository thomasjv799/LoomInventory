import type { MutationCtx } from "../_generated/server";
import type { Id, TableNames } from "../_generated/dataModel";
import { fail, validateSeedRow } from "./validation";
export const tableMap = {
  locations: "locations",
  bins: "bins",
  products: "products",
  product_images: "productImages",
  variants: "variants",
  transfers: "transfers",
  inventory_ledger: "inventoryLedger",
  transfer_receipts: "transferReceipts",
  sales_orders: "salesOrders",
  sales_lines: "salesLines",
  reservations: "reservations",
  matching_relationships: "matchingRelationships",
  events: "events",
  influencer_activity: "influencerActivity",
  forecast_runs: "forecastRuns",
  forecast_values: "forecastValues",
} as const;
type SourceTable = keyof typeof tableMap;
type Row = Record<string, string | number | null>;
export async function insertSeedRow(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  datasetVersionId: Id<"datasetVersions">,
  source: SourceTable,
  r: Row,
) {
  validateSeedRow(source, r);
  const table = tableMap[source];
  const org = await ctx.db.get(organizationId),
    version = await ctx.db.get(datasetVersionId);
  if (
    !org ||
    !version ||
    version.organizationId !== organizationId ||
    version.status !== "staged"
  )
    fail("INVALID_INPUT", "Invalid staging version");
  const ref = async (
    target: (typeof tableMap)[SourceTable],
    external: unknown,
  ) => {
    if (typeof external !== "string")
      fail("INVALID_INPUT", "Missing reference");
    const result = await ctx.db
      .query(target)
      .withIndex("by_external", (q) =>
        q
          .eq("organizationId", organizationId)
          .eq("datasetVersionId", datasetVersionId)
          .eq("externalId", external),
      )
      .unique();
    if (!result)
      fail("INVALID_INPUT", `Unknown ${target} reference: ${external}`);
    return result._id;
  };
  const existing = await ctx.db
    .query(table)
    .withIndex("by_external", (q) =>
      q
        .eq("organizationId", organizationId)
        .eq("datasetVersionId", datasetVersionId)
        .eq("externalId", String(r.id)),
    )
    .unique();
  if (existing) fail("CONFLICT", `Duplicate source ID ${r.id}`);
  let fields: Record<string, unknown> = {};
  switch (source) {
    case "locations":
      fields = { name: r.name, city: r.city, type: r.kind, active: true };
      break;
    case "bins":
      fields = {
        locationId: await ref("locations", r.location_id),
        name: r.name,
        excludedFromAvailability:
          !!r.excluded ||
          String(r.name).trim().toLowerCase() === "dispatch center",
      };
      break;
    case "products":
      fields = {
        sku: r.sku,
        name: r.name,
        category: r.category,
        color: r.color,
        fabric: r.fabric,
        craft: r.craft,
        kurtaLength: r.kurta_length_inches,
        style: r.style,
        collection: r.collection,
        season: r.season,
        launchDate: r.launch_date,
        costMinor: r.cost_minor,
        suggestedMrpMinor: r.suggested_mrp_minor,
        provenance: JSON.parse(String(r.provenance_json)),
        archived: false,
        version: 1,
      };
      break;
    case "product_images":
      fields = {
        productId: await ref("products", r.product_id),
        url: r.url,
        sourceProductUrl: r.source_product_url,
        alt: r.alt,
        width: r.width,
        height: r.height,
        verifiedOn: r.verified_on,
      };
      break;
    case "variants":
      fields = {
        productId: await ref("products", r.product_id),
        size: r.size,
        sku: r.sku,
        active: true,
      };
      break;
    case "transfers":
      fields = {
        sourceId: await ref("locations", r.source_id),
        destinationId: await ref("locations", r.destination_id),
        variantId: await ref("variants", r.variant_id),
        dispatched: r.dispatched_qty,
        received: 0,
        eta: r.eta,
        dispatchDate: r.dispatch_date,
        ownerOrganizationId: organizationId,
        status: "in_transit",
      };
      break;
    case "inventory_ledger":
      fields = {
        eventGroupId: String(r.id),
        variantId: await ref("variants", r.variant_id),
        locationId: await ref("locations", r.location_id),
        binId: await ref("bins", r.bin_id),
        condition: r.condition,
        quantityDelta: r.quantity_delta,
        effectiveAt: r.effective_date,
        recordedAt: Date.now(),
        reason: r.reason,
        sourceId: r.source_reference,
        actorId: "seed",
      };
      break;
    case "transfer_receipts":
      fields = {
        transferId: await ref("transfers", r.transfer_id),
        quantity: r.quantity,
        receiptDate: r.received_date,
        linkedMovementId: await ref("inventoryLedger", r.movement_id),
      };
      break;
    case "sales_orders":
      fields = {
        locationId: await ref("locations", r.location_id),
        channel: r.channel,
        businessDate: r.sale_date,
        sourceReference: r.source_reference,
      };
      break;
    case "sales_lines":
      fields = {
        orderId: await ref("salesOrders", r.order_id),
        variantId: await ref("variants", r.variant_id),
        quantity: r.quantity,
        transactionMrpMinor: r.transaction_mrp_minor,
        netValueMinor: r.net_line_value_minor,
        linkedMovementId: await ref("inventoryLedger", r.movement_id),
        matchingStatus: r.matching_status,
        matchingDupattaId: r.matching_dupatta_id
          ? await ref("products", r.matching_dupatta_id)
          : null,
      };
      break;
    case "reservations":
      fields = {
        variantId: await ref("variants", r.variant_id),
        locationId: await ref("locations", r.location_id),
        quantity: r.quantity,
      };
      break;
    case "matching_relationships":
      fields = {
        outfitId: await ref("products", r.outfit_id),
        dupattaId: await ref("products", r.dupatta_id),
        relationship: r.description,
        ratio: r.ratio,
      };
      break;
    case "events":
      fields = {
        name: r.name,
        start: r.start_date,
        end: r.end_date,
        kind: r.kind,
        multiplier: r.multiplier,
        sourceUrl: r.source_url,
        note: r.note,
      };
      break;
    case "influencer_activity":
      fields = {
        productId: await ref("products", r.product_id),
        name: r.name,
        type: r.kind,
        date: r.activity_date,
        channel: r.channel,
        note: r.note,
      };
      break;
    case "forecast_runs":
      fields = {
        asOf: r.as_of,
        scope: r.scope,
        status: r.status,
        assumptions: r.assumptions_json,
      };
      break;
    case "forecast_values":
      fields = {
        runId: await ref("forecastRuns", r.run_id),
        variantId: await ref("variants", r.variant_id),
        month: r.month,
        units: r.units,
        factor: r.factor,
        method: r.method,
      };
      break;
  }
  if (source === "inventory_ledger") {
    const bin = await ctx.db.get(fields.binId as Id<"bins">);
    if (bin?.locationId !== fields.locationId)
      fail("INVALID_INPUT", "Bin is at a different location");
  }
  const id = await ctx.db.insert(table, {
    ...fields,
    organizationId,
    datasetVersionId,
    externalId: String(r.id),
  } as never);
  if (source === "inventory_ledger") {
    const event = await ctx.db.get(id as Id<"inventoryLedger">);
    if (!event) throw new Error("Missing inserted event");
    const key = `${r.variant_id}:${r.location_id}:${r.bin_id}:${r.condition}`;
    const b = await ctx.db
      .query("stockBalances")
      .withIndex("by_external", (q) =>
        q
          .eq("organizationId", organizationId)
          .eq("datasetVersionId", datasetVersionId)
          .eq("externalId", key),
      )
      .unique();
    if (b)
      await ctx.db.patch(b._id, { quantity: b.quantity + event.quantityDelta });
    else
      await ctx.db.insert("stockBalances", {
        organizationId,
        datasetVersionId,
        externalId: key,
        variantId: event.variantId,
        locationId: event.locationId,
        binId: event.binId,
        condition: event.condition,
        quantity: event.quantityDelta,
        watermark: 0,
      });
  }
  if (source === "transfer_receipts") {
    const t = await ctx.db.get(fields.transferId as Id<"transfers">);
    if (!t) throw new Error("Missing transfer");
    const received = t.received + Number(r.quantity);
    if (received > t.dispatched)
      fail("INVALID_INPUT", "Over-received seed transfer");
    await ctx.db.patch(t._id, {
      received,
      status: received === t.dispatched ? "received" : "in_transit",
    });
  }
  if (source === "sales_lines") {
    const movement = await ctx.db.get(
        fields.linkedMovementId as Id<"inventoryLedger">,
      ),
      order = await ctx.db.get(fields.orderId as Id<"salesOrders">);
    if (
      !movement ||
      !order ||
      movement.variantId !== fields.variantId ||
      movement.locationId !== order.locationId ||
      movement.quantityDelta !== -Number(r.quantity)
    )
      fail("INVALID_INPUT", "Sales movement does not reconcile");
  }
  return id;
}
