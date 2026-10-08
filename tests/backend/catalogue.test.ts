import { test, expect } from "vitest";
import { workspace, productInput } from "./fixtures";
import { makeFunctionReference } from "convex/server";
test("creates dress and variants without stock and safely replays creation", async () => {
  const { t, signed, organizationId } = await workspace();
  const create = makeFunctionReference<"mutation">("catalogue:create");
  const args = {
    organizationId,
    input: productInput,
    idempotencyKey: "new-style",
  };
  const first = await signed.mutation(create, args);
  expect(await signed.mutation(create, args)).toEqual(first);
  expect(await t.run((ctx) => ctx.db.query("variants").collect())).toHaveLength(
    2,
  );
  expect(
    await t.run((ctx) => ctx.db.query("inventoryLedger").collect()),
  ).toHaveLength(0);
  await expect(
    signed.mutation(create, {
      ...args,
      input: { ...productInput, name: "Changed" },
    }),
  ).rejects.toThrow("CONFLICT");
  await expect(
    signed.mutation(create, { ...args, idempotencyKey: "other" }),
  ).rejects.toThrow("Duplicate");
});
