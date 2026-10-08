import { fail, validateSeedRow } from "./validation";
import type { Snapshot } from "./snapshot";
export const inputTypes = [
  "product-master",
  "opening-ho",
  "opening-stores",
  "ho-additions",
  "ho-reductions",
  "ecommerce-sales",
  "store-sales",
  "influencer-activity",
  "event-calendar",
  "bin-data",
  "store-transit",
] as const;
export function reconcileSnapshot(snapshot: Snapshot) {
  const ledger = new Map<string, number>();
  for (const r of snapshot.inventoryLedger) {
    const key = `${r.variantId}:${r.locationId}:${r.binId}:${r.condition}`;
    ledger.set(key, (ledger.get(key) || 0) + r.quantityDelta);
  }
  for (const b of snapshot.stockBalances) {
    const key = `${b.variantId}:${b.locationId}:${b.binId}:${b.condition}`;
    if (b.quantity < 0 || b.quantity !== ledger.get(key))
      fail("INVALID_INPUT", "Ledger/balance reconciliation failed");
    ledger.delete(key);
  }
  if (ledger.size) fail("INVALID_INPUT", "Missing materialized balances");
  const movements = new Map(snapshot.inventoryLedger.map((r) => [r._id, r])),
    orders = new Map(snapshot.salesOrders.map((r) => [r._id, r]));
  const deductions = new Set<string>();
  for (const line of snapshot.salesLines) {
    const m = movements.get(line.linkedMovementId),
      o = orders.get(line.orderId);
    if (
      !m ||
      !o ||
      m.variantId !== line.variantId ||
      m.locationId !== o.locationId ||
      m.quantityDelta !== -line.quantity ||
      deductions.has(m._id)
    )
      fail("INVALID_INPUT", "Sales deduction reconciliation failed");
    deductions.add(m._id);
  }
  const transfers = new Map(snapshot.transfers.map((t) => [t._id, t]));
  const receiptMovements = new Set<string>();
  const received = new Map<string, number>();
  for (const receipt of snapshot.transferReceipts) {
    const transfer = transfers.get(receipt.transferId),
      movement = movements.get(receipt.linkedMovementId);
    if (
      !transfer ||
      !movement ||
      !Number.isSafeInteger(receipt.quantity) ||
      receipt.quantity <= 0 ||
      movement.variantId !== transfer.variantId ||
      movement.locationId !== transfer.destinationId ||
      movement.quantityDelta !== receipt.quantity ||
      movement.condition !== "sellable" ||
      movement.effectiveAt !== receipt.receiptDate ||
      receiptMovements.has(movement._id)
    )
      fail("INVALID_INPUT", "Transfer receipt movement reconciliation failed");
    receiptMovements.add(movement._id);
    received.set(
      transfer._id,
      (received.get(transfer._id) ?? 0) + receipt.quantity,
    );
  }
  for (const transfer of snapshot.transfers)
    if ((received.get(transfer._id) ?? 0) !== transfer.received)
      fail("INVALID_INPUT", "Transfer receipt total reconciliation failed");
  if (
    snapshot.transfers.some((t) => t.received > t.dispatched || t.received < 0)
  )
    fail("INVALID_INPUT", "Transfer reconciliation failed");
  return {
    products: snapshot.products.length,
    variants: snapshot.variants.length,
    sales: snapshot.salesLines.length,
    ledgerRows: snapshot.inventoryLedger.length,
    physical: snapshot.stockBalances.reduce((n, b) => n + b.quantity, 0),
    netValueMinor: snapshot.salesLines.reduce(
      (n, s) => n + (s.netValueMinor ?? 0),
      0,
    ),
    inTransit: snapshot.transfers.reduce(
      (n, t) => n + t.dispatched - t.received,
      0,
    ),
  };
}
export function validateSourceRows(
  table: string,
  rows: Record<string, unknown>[],
) {
  for (const row of rows) {
    if (typeof row.id !== "string" || !row.id)
      fail("INVALID_INPUT", "Every source row needs an ID");
    validateSeedRow(table, row);
  }
}
export function validateReferences(
  chunks: { chunkKey: string; rows: string }[],
  ids: Record<string, Set<string>>,
) {
  const targets: Record<string, Record<string, string>> = {
    bins: { location_id: "locations" },
    variants: { product_id: "products" },
    product_images: { product_id: "products" },
    transfers: {
      variant_id: "variants",
      source_id: "locations",
      destination_id: "locations",
    },
    inventory_ledger: {
      variant_id: "variants",
      location_id: "locations",
      bin_id: "bins",
      transfer_id: "transfers",
    },
    transfer_receipts: {
      transfer_id: "transfers",
      movement_id: "inventory_ledger",
    },
    sales_orders: { location_id: "locations" },
    sales_lines: {
      order_id: "sales_orders",
      variant_id: "variants",
      movement_id: "inventory_ledger",
      matching_dupatta_id: "products",
    },
    reservations: { variant_id: "variants", location_id: "locations" },
    matching_relationships: { outfit_id: "products", dupatta_id: "products" },
    influencer_activity: { product_id: "products" },
    forecast_values: { run_id: "forecast_runs", variant_id: "variants" },
  };
  const origins = new Set<string>();
  for (const chunk of chunks)
    for (const row of JSON.parse(chunk.rows)) {
      if (row.org_id) origins.add(row.org_id);
      for (const [field, target] of Object.entries(
        targets[chunk.chunkKey.split(":")[0]] ?? {},
      ))
        if (row[field] !== null && !ids[target]?.has(row[field]))
          fail(
            "INVALID_INPUT",
            `Dangling ${field} reference at source ID ${row.id}`,
          );
    }
  if (origins.size > 1)
    fail("INVALID_INPUT", "Mixed source organizations in one snapshot");
}
