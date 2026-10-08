import { test, expect } from "vitest";
import { backend } from "./setup";
import { makeFunctionReference } from "convex/server";
const me = makeFunctionReference<"query">("memberships:me");
const locations = makeFunctionReference<"query">("memberships:locations");
test("separates sign-in from access and revokes membership on subsequent reads", async () => {
  const t = backend();
  await expect(t.query(me, {})).rejects.toThrow("UNAUTHENTICATED");
  const signed = t.withIdentity({ subject: "u1" });
  expect(await signed.query(me, {})).toMatchObject({ memberships: [] });
  const { organizationId, membershipId } = await t.run(async (ctx) => {
    const organizationId = await ctx.db.insert("organizations", {
      name: "Demo",
      currency: "INR",
      timezone: "Asia/Kolkata",
      sourceWatermark: 0,
      synthetic: true,
    });
    const membershipId = await ctx.db.insert("memberships", {
      organizationId,
      authUserId: "u1",
      role: "viewer",
      active: true,
      allowedLocationIds: [],
      costRead: false,
      networkRead: false,
    });
    return { organizationId, membershipId };
  });
  expect((await signed.query(me, {})).memberships).toHaveLength(1);
  await t.run((ctx) => ctx.db.patch(membershipId, { active: false }));
  await expect(signed.query(locations, { organizationId })).rejects.toThrow(
    "FORBIDDEN",
  );
});
