import { test, expect } from "vitest";
import { makeFunctionReference } from "convex/server";
import { workspace, productInput } from "./fixtures";
import { inputTypes, reconcileSnapshot } from "../../convex/domain/imports";
import { snapshotTables, type Snapshot } from "../../convex/domain/snapshot";
import { buildReport } from "../../lib/report-adapters";
import { defaults } from "../../lib/analytics";
import { readFileSync } from "node:fs";
import type { Dataset } from "../../lib/types";
const mutation = (name: string) => makeFunctionReference<"mutation">(name);
const query = (name: string) => makeFunctionReference<"query">(name);
async function stocked(quantity = 101) {
  const w = await workspace();
  await w.signed.mutation(mutation("catalogue:create"), {
    organizationId: w.organizationId,
    input: productInput,
    idempotencyKey: "style",
  });
  const variant = (await w.t.run((ctx) => ctx.db.query("variants").first()))!;
  const args = {
    organizationId: w.organizationId,
    variantId: variant._id,
    locationId: w.locationId,
    binId: w.binId,
    date: "2026-10-06",
    quantity,
  };
  await w.signed.mutation(mutation("operations:receiveStock"), {
    ...args,
    idempotencyKey: "stock",
  });
  return { ...w, variant, args };
}
test("complete-snapshot imports reject omitted manifest tables", async () => {
  const { signed, organizationId } = await workspace();
  await expect(
    signed.mutation(mutation("imports:create"), {
      organizationId,
      sourceHash: "incomplete",
      asOf: "2026-10-06",
      cutoff: "2024-10-06",
      expectedCounts: {},
      inputTypes: [...inputTypes],
      idempotencyKey: "incomplete",
    }),
  ).rejects.toThrow("manifest");
});
test("publication retries and stale failures cannot downgrade the active version", async () => {
  const { t, organizationId } = await workspace();
  const ids = await t.run(async (ctx) => {
    const datasetVersionId = await ctx.db.insert("datasetVersions", {
      organizationId,
      sourceHash: "replacement",
      status: "ready",
      asOf: "2026-10-06",
      baseWatermark: 0,
    });
    const batchId = await ctx.db.insert("importBatches", {
      organizationId,
      datasetVersionId,
      datasetType: "snapshot",
      sourceHash: "replacement",
      status: "committing",
      cursor: null,
      rows: 0,
      rejected: 0,
    });
    return { datasetVersionId, batchId };
  });
  const args = {
    datasetVersionId: ids.datasetVersionId,
    expectedSourceWatermark: 0,
    batchId: ids.batchId,
  };
  await t.mutation(mutation("imports:activate"), args);
  expect((await t.run((ctx) => ctx.db.get(ids.batchId)))!.status).toBe("ready");
  await expect(
    t.mutation(mutation("imports:activate"), args),
  ).resolves.toMatchObject({ datasetVersionId: ids.datasetVersionId });
  await t.mutation(mutation("imports:finish"), {
    batchId: ids.batchId,
    status: "failed",
    message: "stale worker",
  });
  expect((await t.run((ctx) => ctx.db.get(ids.datasetVersionId)))!.status).toBe(
    "ready",
  );
  expect((await t.run((ctx) => ctx.db.get(ids.batchId)))!.status).toBe("ready");
  expect(
    (await t.run((ctx) => ctx.db.get(organizationId)))!.sourceWatermark,
  ).toBe(1);
});
test.each([
  "quantity",
  "variant",
  "destination",
  "reused movement",
  "received total",
])("receipt reconciliation rejects %s mismatches", async (kind) => {
  const w = await stocked(1);
  await w.t.run(async (ctx) => {
    const movement = (await ctx.db.query("inventoryLedger").first())!;
    const otherVariant = (await ctx.db.query("variants").collect())[1];
    const destination = await ctx.db.insert("locations", {
      organizationId: w.organizationId,
      datasetVersionId: w.datasetVersionId,
      externalId: "STORE",
      name: "Delhi",
      city: "Delhi",
      type: "store",
      active: true,
    });
    const transferId = await ctx.db.insert("transfers", {
      organizationId: w.organizationId,
      datasetVersionId: w.datasetVersionId,
      externalId: "T",
      sourceId: destination,
      destinationId: kind === "destination" ? destination : w.locationId,
      variantId: kind === "variant" ? otherVariant._id : w.variant._id,
      dispatched: 10,
      received:
        kind === "received total"
          ? 5
          : kind === "reused movement"
            ? 2
            : kind === "quantity"
              ? 10
              : 1,
      eta: "2026-10-07",
      dispatchDate: "2026-10-06",
      ownerOrganizationId: w.organizationId,
      status: "received",
    });
    const row = {
      organizationId: w.organizationId,
      datasetVersionId: w.datasetVersionId,
      externalId: "R1",
      transferId,
      quantity: kind === "quantity" ? 10 : 1,
      receiptDate: "2026-10-06",
      linkedMovementId: movement._id,
    };
    await ctx.db.insert("transferReceipts", row);
    if (kind === "reused movement")
      await ctx.db.insert("transferReceipts", { ...row, externalId: "R2" });
  });
  const snapshot = await w.t.run(async (ctx) => {
    const s = {} as Snapshot;
    for (const table of snapshotTables)
      s[table] = (await ctx.db.query(table).collect()) as never;
    return s;
  });
  expect(() => reconcileSnapshot(snapshot)).toThrow("receipt");
});
test("more than 100 reservations fail closed instead of permitting a reserved sale", async () => {
  const w = await stocked();
  await w.t.run(async (ctx) => {
    for (let i = 0; i < 101; i++)
      await ctx.db.insert("reservations", {
        organizationId: w.organizationId,
        datasetVersionId: w.datasetVersionId,
        externalId: "R" + i,
        variantId: w.variant._id,
        locationId: w.locationId,
        quantity: 1,
      });
  });
  await expect(
    w.signed.mutation(mutation("operations:recordSale"), {
      ...w.args,
      quantity: 1,
      transactionMrpMinor: 100,
      netValueMinor: 100,
      channel: "Ecommerce",
      idempotencyKey: "sale",
    }),
  ).rejects.toThrow();
  expect(
    await w.t.run((ctx) => ctx.db.query("salesLines").collect()),
  ).toHaveLength(0);
});
test("balance overflow never creates a duplicate bin balance", async () => {
  const w = await stocked(1);
  const lastBin = await w.t.run(async (ctx) => {
    let binId = w.binId;
    for (let i = 0; i < 100; i++) {
      binId = await ctx.db.insert("bins", {
        organizationId: w.organizationId,
        datasetVersionId: w.datasetVersionId,
        externalId: "B" + i,
        locationId: w.locationId,
        name: "Bin " + i,
        excludedFromAvailability: false,
      });
      await ctx.db.insert("stockBalances", {
        organizationId: w.organizationId,
        datasetVersionId: w.datasetVersionId,
        externalId: "BAL" + i,
        variantId: w.variant._id,
        locationId: w.locationId,
        binId,
        condition: "sellable",
        quantity: 1,
        watermark: 0,
      });
    }
    return binId;
  });
  await expect(
    w.signed.mutation(mutation("operations:receiveStock"), {
      ...w.args,
      binId: lastBin,
      idempotencyKey: "overflow",
    }),
  ).rejects.toThrow("limit");
  expect(
    await w.t.run((ctx) => ctx.db.query("stockBalances").collect()),
  ).toHaveLength(101);
});
test("report products outside the first catalogue page can be resolved securely", async () => {
  const w = await stocked(1);
  const target = await w.t.run(async (ctx) => {
    const original = (await ctx.db.query("products").first())!;
    const { _id, _creationTime, ...fields } = original;
    let id = _id;
    for (let i = 0; i < 100; i++)
      id = await ctx.db.insert("products", {
        ...fields,
        sku: "LATE" + i,
        externalId: "ZZ" + i,
      });
    return id;
  });
  const page = await w.signed.query(query("catalogue:list"), {
    organizationId: w.organizationId,
    limit: 100,
  });
  expect(page.data.some((p: { _id: string }) => p._id === target)).toBe(false);
  const resolved = await w.signed.query(query("catalogue:resolve"), {
    organizationId: w.organizationId,
    externalId: "ZZ99",
  });
  expect(resolved.productId).toBe(target);
});
test("filtering a size preserves the unfiltered style size-mix denominator", () => {
  const d = JSON.parse(readFileSync("data/mock-data.json", "utf8")) as Dataset;
  const all = buildReport(d, "size-packs", { location: "S1" }, defaults),
    selected = buildReport(
      d,
      "size-packs",
      { location: "S1", size: "M" },
      defaults,
    );
  const row = selected.rows.find((r) => Number(r.sold) > 0)!;
  expect(row).toBeTruthy();
  expect(row.observedRatioPercent).toBe(
    all.rows.find((r) => r.id === row.id)!.observedRatioPercent,
  );
  expect(row.observedRatioPercent).toBeLessThan(100);
});
