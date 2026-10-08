import { test, expect } from "vitest";
import { validateEnvironment } from "../lib/environment";
test("rejects exposed secrets and untrusted deployment URLs", () => {
  expect(() =>
    validateEnvironment({
      NEXT_PUBLIC_DATA_MODE: "demo",
      NEXT_PUBLIC_GOOGLE_CLIENT_SECRET: "bad",
    }),
  ).toThrow("Secret");
  expect(() =>
    validateEnvironment({
      NEXT_PUBLIC_DATA_MODE: "convex",
      NEXT_PUBLIC_CONVEX_URL: "http://evil.test",
      NEXT_PUBLIC_CONVEX_SITE_URL: "https://x.convex.site",
      NEXT_PUBLIC_SITE_URL: "https://x.netlify.app",
    }),
  ).toThrow();
});
