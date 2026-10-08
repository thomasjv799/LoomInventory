import { test, expect } from "vitest";
import { makeFunctionReference } from "convex/server";
import { workspace, productInput } from "./fixtures";
import { scopeFingerprint } from "../../convex/reports";
import { requireAccess } from "../../convex/access";
const mutate = (name: string) => makeFunctionReference<"mutation">(name);
test("advances the trading cutoff and permits stock to leave an excluded bin without allowing its sale", async () => {
  const { t, signed, organizationId, locationId, binId, datasetVersionId } =
    await workspace();
  await signed.mutation(mutate("catalogue:create"), {
    organizationId,
    input: productInput,
    idempotencyKey: "p",
  });
  const variant = await t.run((ctx) => ctx.db.query("variants").first());
  const excluded = await t.run((ctx) =>
    ctx.db.insert("bins", {
      organizationId,
      datasetVersionId,
      externalId: "DISPATCH",
      locationId,
      name: "Dispatch center",
      excludedFromAvailability: true,
    }),
  );
  const args = {
    organizationId,
    locationId,
    variantId: variant!._id,
    binId: excluded,
    date: "2026-10-08",
    quantity: 2,
  };
  await signed.mutation(mutate("operations:receiveStock"), {
    ...args,
    idempotencyKey: "receive",
  });
  expect((await t.run((ctx) => ctx.db.get(datasetVersionId)))!.asOf).toBe(
    "2026-10-09",
  );
  await expect(
    signed.mutation(mutate("operations:recordSale"), {
      ...args,
      transactionMrpMinor: 100,
      netValueMinor: 200,
      channel: "Ecommerce",
      idempotencyKey: "sale",
    }),
  ).rejects.toThrow("unavailable");
  await signed.mutation(mutate("operations:moveBin"), {
    ...args,
    destinationBinId: binId,
    condition: "sellable",
    idempotencyKey: "move",
  });
  const balances = await t.run((ctx) =>
    ctx.db.query("stockBalances").collect(),
  );
  expect(balances.reduce((n, b) => n + b.quantity, 0)).toBe(2);
  expect(balances.find((b) => b.binId === binId)!.quantity).toBe(2);
});
test("competing transfers cannot oversell and partial receipts cannot over-receive", async () => {
  const { t, signed, organizationId, locationId, binId, datasetVersionId } =
    await workspace();
  const target = await t.run(async (ctx) => {
    const id = await ctx.db.insert("locations", {
      organizationId,
      datasetVersionId,
      externalId: "STORE",
      name: "Delhi",
      city: "Delhi",
      type: "store",
      active: true,
    });
    const bin = await ctx.db.insert("bins", {
      organizationId,
      datasetVersionId,
      externalId: "STOREBIN",
      name: "Main",
      locationId: id,
      excludedFromAvailability: false,
    });
    const member = await ctx.db.query("memberships").first();
    await ctx.db.patch(member!._id, { allowedLocationIds: [locationId, id] });
    return { id, bin };
  });
  await signed.mutation(mutate("catalogue:create"), {
    organizationId,
    input: productInput,
    idempotencyKey: "p",
  });
  const variant = await t.run((ctx) => ctx.db.query("variants").first());
  const args = {
    organizationId,
    locationId,
    binId,
    variantId: variant!._id,
    date: "2026-10-06",
    quantity: 5,
  };
  await signed.mutation(mutate("operations:receiveStock"), {
    ...args,
    idempotencyKey: "receive",
  });
  const results = await Promise.allSettled(
    ["a", "b"].map((idempotencyKey) =>
      signed.mutation(mutate("operations:dispatchTransfer"), {
        ...args,
        quantity: 4,
        destinationId: target.id,
        eta: "2026-10-09",
        idempotencyKey,
      }),
    ),
  );
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  const transfer = await t.run((ctx) => ctx.db.query("transfers").first());
  expect(transfer!.ownerOrganizationId).toBe(organizationId);
  const receipt = {
    organizationId,
    transferId: transfer!._id,
    binId: target.bin,
    date: "2026-10-09",
    quantity: 2,
    idempotencyKey: "partial",
  };
  await signed.mutation(mutate("operations:receiveTransfer"), receipt);
  await signed.mutation(mutate("operations:receiveTransfer"), receipt);
  await expect(
    signed.mutation(mutate("operations:receiveTransfer"), {
      ...receipt,
      quantity: 3,
      idempotencyKey: "over",
    }),
  ).rejects.toThrow("over-receipt");
  expect((await t.run((ctx) => ctx.db.get(transfer!._id)))!.received).toBe(2);
});
test("narrowed grants invalidate already prepared report pages and exports", async () => {
  const { t, signed, organizationId, datasetVersionId } = await workspace();
  const runId = await signed.run(async (ctx) => {
    const scope = await requireAccess(ctx, {
      organizationId,
      capability: "read",
    });
    return ctx.db.insert("reportRuns", {
      organizationId,
      datasetVersionId,
      authUserId: "admin",
      scopeHash: scopeFingerprint(scope),
      name: "inventory",
      filters: "{}",
      sourceWatermark: 0,
      settingsVersion: 0,
      algorithmVersion: "demo-v1",
      status: "ready",
      totals: JSON.stringify({
        columns: [],
        totals: {},
        charts: [],
        notes: [],
      }),
      expiresAt: Date.now() + 60000,
      checkpoint: "",
    });
  });
  await signed.query(makeFunctionReference<"query">("reports:page"), {
    organizationId,
    runId,
  });
  await t.run(async (ctx) => {
    const m = await ctx.db.query("memberships").first();
    await ctx.db.patch(m!._id, { allowedLocationIds: [] });
  });
  await expect(
    signed.query(makeFunctionReference<"query">("reports:page"), {
      organizationId,
      runId,
    }),
  ).rejects.toThrow("FORBIDDEN");
  await expect(
    signed.query(makeFunctionReference<"query">("exports:page"), {
      organizationId,
      runId,
    }),
  ).rejects.toThrow("FORBIDDEN");
});
test("viewer receives redacted costs and cannot write or cross an organization boundary", async () => {
  const { t, signed, organizationId, locationId, binId, datasetVersionId } =
    await workspace();
  const p = await signed.mutation(mutate("catalogue:create"), {
    organizationId,
    input: productInput,
    idempotencyKey: "p",
  });
  await t.run(async (ctx) => {
    await ctx.db.insert("memberships", {
      authUserId: "viewer",
      organizationId,
      role: "viewer",
      allowedLocationIds: [locationId],
      active: true,
      costRead: false,
      networkRead: false,
    });
  });
  const viewer = t.withIdentity({ subject: "viewer" });
  const detail = await viewer.query(
    makeFunctionReference<"query">("catalogue:detail"),
    { organizationId, productId: p.productId },
  );
  expect(detail.product.costMinor).toBeNull();
  await expect(
    viewer.mutation(mutate("catalogue:create"), {
      organizationId,
      input: productInput,
      idempotencyKey: "denied",
    }),
  ).rejects.toThrow("FORBIDDEN");
  const other = {
    organizationId: await t.run((ctx) =>
      ctx.db.insert("organizations", {
        name: "Other",
        currency: "INR",
        timezone: "Asia/Kolkata",
        sourceWatermark: 0,
        synthetic: true,
      }),
    ),
  };
  await expect(
    viewer.query(makeFunctionReference<"query">("catalogue:list"), {
      organizationId: other.organizationId,
    }),
  ).rejects.toThrow();
  const count = await t.run((ctx) => ctx.db.query("inventoryLedger").collect());
  expect(count).toHaveLength(0);
});
