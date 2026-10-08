import { afterEach, expect, test, vi } from "vitest";
import betterAuthTest from "@convex-dev/better-auth/test";
import { handleOAuthUserInfo } from "better-auth/oauth2";
import { createAuth } from "../../convex/auth";
import { components } from "../../convex/_generated/api";
import { workspace } from "./fixtures";

afterEach(() => vi.unstubAllEnvs());

async function existingPasswordUser() {
  const w = await workspace();
  betterAuthTest.register(w.t);
  vi.stubEnv("SITE_URL", "https://inventory.example.test");
  vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-with-at-least-32-characters");
  const seeded = await w.t.run(async (ctx) => {
    const auth = createAuth(ctx);
    const context = await auth.$context;
    const user = await context.internalAdapter.createUser({
      name: "Inventory administrator",
      email: "admin@example.test",
      emailVerified: false,
    });
    await context.internalAdapter.createAccount({
      userId: user.id,
      accountId: user.id,
      providerId: "credential",
      password: "existing-test-hash",
    });
    const membershipId = await ctx.db.insert("memberships", {
      authUserId: user.id,
      organizationId: w.organizationId,
      role: "administrator",
      allowedLocationIds: [w.locationId],
      active: true,
      costRead: true,
      networkRead: true,
    });
    return { userId: user.id, membershipId };
  });
  return { w, ...seeded };
}

// Exercise the real Better Auth post-provider-verification path and Convex
// adapter. No Google secrets, external token exchange or fabricated sessions.
async function linkGoogle(verified: boolean) {
  const { w, userId, membershipId } = await existingPasswordUser();
  return w.t.run(async (ctx) => {
    const context = await createAuth(ctx).$context;
    const result = await handleOAuthUserInfo(
      { context } as Parameters<typeof handleOAuthUserInfo>[0],
      {
        userInfo: {
          id: "google-subject-123",
          email: "admin@example.test",
          emailVerified: verified,
          name: "Asha Rao",
          image: "https://images.example.test/asha.jpg",
        },
        account: { accountId: "google-subject-123", providerId: "google" },
      },
    );
    const googleAccount = await ctx.runQuery(
      components.betterAuth.adapter.findOne,
      { model: "account", where: [{ field: "providerId", value: "google" }] },
    );
    const profile = await context.internalAdapter.findUserById(userId);
    return {
      result,
      googleAccount,
      profile,
      userId,
      membership: await ctx.db.get(membershipId),
    };
  });
}

test("verified Google email signs in to the existing password account and keeps its permissions", async () => {
  const linked = await linkGoogle(true);
  expect(linked.result.error).toBeNull();
  expect(linked.result.data?.session.userId).toBe(linked.userId);
  expect(linked.googleAccount?.userId).toBe(linked.userId);
  expect(linked.profile?.emailVerified).toBe(true);
  expect(linked.profile?.name).toBe("Asha Rao");
  expect(linked.result.data?.user.name).toBe("Asha Rao");
  expect(linked.membership).toMatchObject({
    role: "administrator",
    costRead: true,
    active: true,
  });
});

test("unverified Google email cannot link to an existing password account", async () => {
  const linked = await linkGoogle(false);
  expect(linked.result.error).toBe("account not linked");
  expect(linked.result.data).toBeNull();
  expect(linked.googleAccount).toBeNull();
  expect(linked.profile?.emailVerified).toBe(false);
  expect(linked.profile?.name).toBe("Inventory administrator");
});
