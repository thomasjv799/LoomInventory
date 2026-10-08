import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth/minimal";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import authConfig from "./auth.config";
export const authComponent = createClient<DataModel>(components.betterAuth);
export const createAuth = (ctx: GenericCtx<DataModel>) => {
  if (
    !process.env.SITE_URL ||
    !process.env.BETTER_AUTH_SECRET ||
    process.env.BETTER_AUTH_SECRET.length < 32
  )
    throw new Error(
      "Authentication requires a site origin and a strong secret",
    );
  return betterAuth({
    baseURL: process.env.SITE_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    database: authComponent.adapter(ctx),
    trustedOrigins: process.env.SITE_URL ? [process.env.SITE_URL] : [],
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
    },
    // Password accounts are provisioned privately. A provider-verified matching
    // email can link them; unverified provider email remains rejected. Keep
    // trustedProviders unset so provider names never bypass email verification.
    account: {
      accountLinking: {
        enabled: true,
        requireLocalEmailVerified: false,
        updateUserInfoOnLink: true,
      },
    },
    rateLimit: { enabled: true, storage: "database" },
    socialProviders: {
      ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: process.env.GOOGLE_CLIENT_ID,
              clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            },
          }
        : {}),
      ...(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET
        ? {
            microsoft: {
              clientId: process.env.MICROSOFT_CLIENT_ID,
              clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
              tenantId: process.env.MICROSOFT_TENANT_ID || "common",
            },
          }
        : {}),
    },
    plugins: [convex({ authConfig })],
  });
};
