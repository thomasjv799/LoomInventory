import { afterEach, expect, test, vi } from "vitest";
import betterAuthTest from "@convex-dev/better-auth/test";
import { makeFunctionReference } from "convex/server";
import { components } from "../../convex/_generated/api";
import { workspace, productInput } from "./fixtures";
const join = makeFunctionReference<"mutation">("googleAccess:join");
const me = makeFunctionReference<"query">("memberships:me");
afterEach(() => vi.unstubAllEnvs());

async function googleWorkspace(provider = "google", expired = false) {
  const w = await workspace();
  betterAuthTest.register(w.t);
  vi.stubEnv("GOOGLE_OPEN_ACCESS_ORGANIZATION_ID", w.organizationId);
  const auth = await w.t.run(async (ctx) => {
    const now = Date.now();
    const user = await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "user",
        data: {
          name: "Asha Rao",
          email: "asha@example.test",
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        },
      },
    });
    const session = await ctx.runMutation(
      components.betterAuth.adapter.create,
      {
        input: {
          model: "session",
          data: {
            token: "test-session-token",
            userId: user._id,
            expiresAt: expired ? now - 1000 : now + 60000,
            createdAt: now,
            updatedAt: now,
          },
        },
      },
    );
    await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "account",
        data: {
          providerId: provider,
          accountId: "google-account",
          userId: user._id,
          createdAt: now,
          updatedAt: now,
        },
      },
    });
    return { userId: user._id, sessionId: session._id };
  });
  return {
    ...w,
    ...auth,
    google: w.t.withIdentity({
      subject: auth.userId,
      sessionId: auth.sessionId,
      name: "Asha Rao",
    }),
  };
}

test("Google users receive one viewer membership for the configured demo only", async () => {
  const w = await googleWorkspace();
  await Promise.all([w.google.mutation(join, {}), w.google.mutation(join, {})]);
  const profile = await w.google.query(me, {});
  expect(profile.user.name).toBe("Asha Rao");
  expect(profile.memberships).toHaveLength(1);
  expect(profile.memberships[0]).toMatchObject({
    role: "viewer",
    costRead: false,
    networkRead: true,
    active: true,
    organizationId: w.organizationId,
    allowedLocationIds: [w.locationId],
  });
  const create = makeFunctionReference<"mutation">("catalogue:create");
  await expect(
    w.google.mutation(create, {
      organizationId: w.organizationId,
      input: productInput,
      idempotencyKey: "denied-google-write",
    }),
  ).rejects.toThrow("FORBIDDEN");
});
test("password or forged Gmail identity cannot self-enroll", async () => {
  const w = await googleWorkspace("credential");
  expect(await w.google.mutation(join, {})).toBe(false);
  await expect(
    w.t
      .withIdentity({ subject: "fake", email: "fake@gmail.com" })
      .mutation(join, {}),
  ).rejects.toThrow();
});
test("expired sessions cannot self-enroll", async () => {
  const w = await googleWorkspace("google", true);
  await expect(w.google.mutation(join, {})).rejects.toThrow();
});
test("automatic access preserves explicit revocation", async () => {
  const w = await googleWorkspace();
  await w.google.mutation(join, {});
  await w.t.run(async (ctx) => {
    const m = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("authUserId", w.userId))
      .unique();
    await ctx.db.patch(m!._id, { active: false });
  });
  expect(await w.google.mutation(join, {})).toBe(false);
  expect((await w.google.query(me, {})).memberships).toHaveLength(0);
});
test("joining does not overwrite an existing administrator's role or grants", async () => {
  const w = await googleWorkspace();
  await w.google.mutation(join, {});
  await w.t.run(async (ctx) => {
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("authUserId", w.userId))
      .unique();
    await ctx.db.patch(membership!._id, {
      role: "administrator",
      costRead: true,
      allowedLocationIds: [],
    });
  });
  expect(await w.google.mutation(join, {})).toBe(true);
  expect((await w.google.query(me, {})).memberships[0]).toMatchObject({
    role: "administrator",
    costRead: true,
    allowedLocationIds: [],
  });
});
test("disabled or non-synthetic targets do not grant public access", async () => {
  const w = await googleWorkspace();
  vi.stubEnv("GOOGLE_OPEN_ACCESS_ORGANIZATION_ID", "");
  expect(await w.google.mutation(join, {})).toBe(false);
  vi.stubEnv("GOOGLE_OPEN_ACCESS_ORGANIZATION_ID", w.organizationId);
  await w.t.run((ctx) => ctx.db.patch(w.organizationId, { synthetic: false }));
  await expect(w.google.mutation(join, {})).rejects.toThrow();
});
