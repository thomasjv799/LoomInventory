import { test, expect } from "vitest";
import { workspace, productInput } from "./fixtures";
import { makeFunctionReference } from "convex/server";
const fn = (name: string) =>
  makeFunctionReference<"mutation">("operations:" + name);
test("sales deduct once and conflicting retries cannot change quantity", async () => {
  const { t, signed, organizationId, locationId, binId } = await workspace();
  const p = await signed.mutation(
    makeFunctionReference<"mutation">("catalogue:create"),
    { organizationId, input: productInput, idempotencyKey: "p" },
  );
  const variant = await t.run((ctx) =>
    ctx.db
      .query("variants")
      .withIndex("by_product", (q) => q.eq("productId", p.productId))
      .first(),
  );
  const common = {
    organizationId,
    variantId: variant!._id,
    locationId,
    binId,
    date: "2026-10-06",
  };
  await signed.mutation(fn("receiveStock"), {
    ...common,
    quantity: 5,
    idempotencyKey: "r",
  });
  const sale = {
    ...common,
    quantity: 2,
    transactionMrpMinor: 300000,
    netValueMinor: 550000,
    channel: "Ecommerce",
    idempotencyKey: "s",
  };
  const result = await signed.mutation(fn("recordSale"), sale);
  expect(await signed.mutation(fn("recordSale"), sale)).toEqual(result);
  expect(
    (await t.run((ctx) => ctx.db.query("stockBalances").first()))!.quantity,
  ).toBe(3);
  expect(
    await t.run((ctx) => ctx.db.query("salesLines").collect()),
  ).toHaveLength(1);
  await expect(
    signed.mutation(fn("recordSale"), { ...sale, quantity: 4 }),
  ).rejects.toThrow("CONFLICT");
  await expect(
    signed.mutation(fn("recordSale"), {
      ...sale,
      quantity: 4,
      idempotencyKey: "new",
    }),
  ).rejects.toThrow("INSUFFICIENT_STOCK");
});
test("quarantined returns stay unavailable until paired QC release", async () => {
  const { t, signed, organizationId, locationId, binId } = await workspace();
  const p = await signed.mutation(
    makeFunctionReference<"mutation">("catalogue:create"),
    { organizationId, input: productInput, idempotencyKey: "p" },
  );
  const variant = await t.run((ctx) => ctx.db.query("variants").first());
  const common = {
    organizationId,
    variantId: variant!._id,
    locationId,
    binId,
    date: "2026-10-06",
    quantity: 3,
  };
  await signed.mutation(fn("quarantineReturn"), {
    ...common,
    idempotencyKey: "return",
  });
  expect(
    (await t.run((ctx) => ctx.db.query("stockBalances").first()))!.condition,
  ).toBe("quarantine");
  await signed.mutation(fn("releaseQc"), { ...common, idempotencyKey: "qc" });
  const balances = await t.run((ctx) =>
    ctx.db.query("stockBalances").collect(),
  );
  expect(balances.find((b) => b.condition === "quarantine")!.quantity).toBe(0);
  expect(balances.find((b) => b.condition === "sellable")!.quantity).toBe(3);
  expect(balances.reduce((n, b) => n + b.quantity, 0)).toBe(3);
});
