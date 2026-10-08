import { test, expect } from "vitest";
import { workspace } from "./fixtures";
import { makeFunctionReference } from "convex/server";
import { readFileSync } from "node:fs";
import { inputTypes } from "../../convex/domain/imports";
test("rejects activation after an intervening operational write", async () => {
  const { t, signed, organizationId } = await workspace();
  const create = makeFunctionReference<"mutation">("imports:create");
  const batch = await signed.mutation(create, {
    organizationId,
    sourceHash: "new",
    asOf: "2026-10-06",
    cutoff: "2024-10-06",
    expectedCounts: { locations: 1, bins: 1, products: 1, variants: 1 },
    inputTypes: [
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
    ],
    idempotencyKey: "import",
  });
  const before = await t.run((ctx) => ctx.db.get(organizationId));
  await t.run(async (ctx) => {
    await ctx.db.patch(batch.datasetVersionId, { status: "ready" });
    await ctx.db.patch(organizationId, { sourceWatermark: 1 });
  });
  await expect(
    t.mutation(makeFunctionReference<"mutation">("imports:activate"), {
      datasetVersionId: batch.datasetVersionId,
      expectedSourceWatermark: 0,
    }),
  ).rejects.toThrow("CONFLICT");
  expect(
    (await t.run((ctx) => ctx.db.get(organizationId)))!.activeDatasetVersionId,
  ).toBe(before!.activeDatasetVersionId);
});
test("preflight rejects dangling references before writing an inactive version", async () => {
  const { t, signed, organizationId } = await workspace();
  const batch = await signed.mutation(
    makeFunctionReference<"mutation">("imports:create"),
    {
      organizationId,
      sourceHash: "dangling",
      asOf: "2026-10-06",
      cutoff: "2024-10-06",
      expectedCounts: { locations: 1, products: 1, variants: 1 },
      inputTypes: [...inputTypes],
      idempotencyKey: "dangling",
    },
  );
  for (const table of ["locations", "products", "variants"]) {
    const row = JSON.parse(
      readFileSync(`data/normalized/${table}.jsonl`, "utf8").split("\n")[0],
    );
    if (table === "variants") row.product_id = "missing";
    await signed.mutation(
      makeFunctionReference<"mutation">("imports:stageChunk"),
      {
        organizationId,
        batchId: batch.batchId,
        table,
        chunkKey: "0",
        rows: JSON.stringify([row]),
      },
    );
  }
  await t.action(makeFunctionReference<"action">("imports:advance"), {
    batchId: batch.batchId,
    phase: "validate",
  });
  const status = await signed.query(
    makeFunctionReference<"query">("imports:status"),
    { organizationId, batchId: batch.batchId },
  );
  expect(status.status).toBe("failed");
  expect(status.cursor).toContain("reference");
  expect(await t.run((ctx) => ctx.db.query("products").collect())).toHaveLength(
    0,
  );
});
