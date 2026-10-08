import { expect, test, beforeEach, afterEach, vi } from "vitest";
beforeEach(() => vi.stubEnv("DEPLOYMENT_ENV", "development"));
afterEach(() => vi.unstubAllEnvs());
import { validateSeedRow, checkChunk } from "../../convex/domain/validation";
import { backend } from "./setup";
import { makeFunctionReference } from "convex/server";
import { readFileSync } from "node:fs";
const begin = makeFunctionReference<"mutation">("seed:begin");
const stage = makeFunctionReference<"mutation">("seed:stageChunk");
test("rejects unsafe money and fractional quantities", () => {
  expect(() =>
    validateSeedRow("products", { costMinor: Number.MAX_SAFE_INTEGER + 1 }),
  ).toThrow();
  expect(() =>
    validateSeedRow("inventoryLedger", { quantityDelta: 1.5 }),
  ).toThrow();
  expect(() =>
    validateSeedRow("products", {
      costMinor: 180000,
      suggestedMrpMinor: 350000,
    }),
  ).not.toThrow();
});
test("remaps catalogue references and replays a chunk without duplication", async () => {
  const t = backend();
  const scope = await t.mutation(begin, {
    sourceHash: "fixture",
    asOf: "2026-10-06",
  });
  const products = readFileSync("data/normalized/products.jsonl", "utf8")
    .trim()
    .split("\n")
    .map(JSON.parse as (value: string) => unknown);
  const variants = readFileSync("data/normalized/variants.jsonl", "utf8")
    .trim()
    .split("\n")
    .map(JSON.parse as (value: string) => unknown);
  const args = {
    ...scope,
    table: "products",
    chunkKey: "0",
    rows: JSON.stringify(products),
  };
  await t.mutation(stage, args);
  await t.mutation(stage, args);
  for (let i = 0; i < variants.length; i += 100)
    await t.mutation(stage, {
      ...scope,
      table: "variants",
      chunkKey: String(i),
      rows: JSON.stringify(variants.slice(i, i + 100)),
    });
  expect(await t.run((ctx) => ctx.db.query("products").collect())).toHaveLength(
    30,
  );
  expect(await t.run((ctx) => ctx.db.query("variants").collect())).toHaveLength(
    150,
  );
  await expect(
    t.mutation(stage, {
      ...scope,
      table: "variants",
      chunkKey: "bad",
      rows: JSON.stringify([
        { id: "bad", product_id: "absent", sku: "bad", size: "S" },
      ]),
    }),
  ).rejects.toThrow("Unknown");
  const other = await t.mutation(begin, {
    sourceHash: "other",
    asOf: "2026-10-06",
  });
  await expect(
    t.mutation(stage, {
      ...scope,
      datasetVersionId: other.datasetVersionId,
      table: "products",
      chunkKey: "foreign",
      rows: JSON.stringify(products),
    }),
  ).rejects.toThrow("Invalid staging");
});
test("caps seed chunks by row count and bytes", () => {
  expect(() => checkChunk(Array.from({ length: 101 }, () => ({})))).toThrow();
  expect(() => checkChunk([{ value: "x".repeat(262145) }])).toThrow();
  expect(() => checkChunk([{ externalId: "P001" }])).not.toThrow();
});
test("preserves unknown image dimensions instead of inventing verification", async () => {
  const t = backend(),
    scope = await t.mutation(begin, {
      sourceHash: "images",
      asOf: "2026-10-06",
    });
  const product = JSON.parse(
    readFileSync("data/normalized/products.jsonl", "utf8").split("\n")[0],
  );
  await t.mutation(stage, {
    ...scope,
    table: "products",
    chunkKey: "0",
    rows: JSON.stringify([product]),
  });
  await t.mutation(stage, {
    ...scope,
    table: "product_images",
    chunkKey: "0",
    rows: JSON.stringify([
      {
        id: "img",
        product_id: product.id,
        url: "https://img.theloom.in/a.jpg",
        source_product_url: "https://theloom.in/a",
        alt: "Product",
        width: null,
        height: null,
        verified_on: null,
      },
    ]),
  });
  expect(
    (await t.run((ctx) => ctx.db.query("productImages").first()))!.height,
  ).toBeNull();
});
