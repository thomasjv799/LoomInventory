import { internalMutation } from "./_generated/server";
import { createAuth } from "./auth";
import { fail } from "./domain/validation";

// Deployment-owner CLI only. No password or provisioning endpoint is public.
export const create = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ authUserId: string; created: boolean }> => {
    const email = process.env.INITIAL_ACCOUNT_EMAIL?.trim().toLowerCase();
    const password = process.env.INITIAL_ACCOUNT_PASSWORD;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      fail(
        "INVALID_INPUT",
        "Set INITIAL_ACCOUNT_EMAIL in the Convex environment",
      );
    if (!password || password.length < 12 || password.length > 128)
      fail("INVALID_INPUT", "Set an initial password of 12–128 characters");
    const auth = await createAuth(ctx).$context;
    const existing = await auth.internalAdapter.findUserByEmail(email!, {
      includeAccounts: true,
    });
    if (existing) {
      if (
        !existing.accounts.some(
          (account) =>
            account.providerId === "credential" &&
            account.accountId === existing.user.id,
        )
      )
        fail(
          "CONFLICT",
          "This email already belongs to a different sign-in account",
        );
      // Repeating provisioning never changes an existing password or permissions.
      return { authUserId: existing.user.id, created: false };
    }
    const hash = await auth.password.hash(password!);
    const user = await auth.internalAdapter.createUser({
      email: email!,
      name: "Inventory administrator",
      emailVerified: false,
    });
    await auth.internalAdapter.linkAccount({
      userId: user.id,
      providerId: "credential",
      accountId: user.id,
      password: hash,
    });
    return { authUserId: user.id, created: true };
  },
});
