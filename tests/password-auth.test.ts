import { expect, test, vi, afterEach } from "vitest";
import { createAuth } from "../convex/auth";
import type { GenericCtx } from "@convex-dev/better-auth";
import type { DataModel } from "../convex/_generated/dataModel";
import { validateEnvironment } from "../lib/environment";

afterEach(() => vi.unstubAllEnvs());
test("password sign-in is enabled without allowing public password registration", () => {
  vi.stubEnv("SITE_URL", "https://inventory.example.test");
  vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-with-at-least-32-characters");
  const auth = createAuth({} as GenericCtx<DataModel>);
  expect(auth.options.emailAndPassword?.enabled).toBe(true);
  expect(auth.options.emailAndPassword?.disableSignUp).toBe(true);
  expect(
    auth.options.emailAndPassword?.minPasswordLength,
  ).toBeGreaterThanOrEqual(12);
});
test("a public Netlify deployment cannot publish the anonymous fixture dashboard", () => {
  expect(() =>
    validateEnvironment({ NETLIFY: "true", NEXT_PUBLIC_DATA_MODE: "demo" }),
  ).toThrow();
});

test("an initial account password cannot be exposed as a frontend variable", () => {
  expect(() =>
    validateEnvironment({
      NEXT_PUBLIC_DATA_MODE: "demo",
      NEXT_PUBLIC_INITIAL_ACCOUNT_PASSWORD: "must-never-be-public",
    }),
  ).toThrow("Secret");
});
