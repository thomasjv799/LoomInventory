import { test, expect } from "vitest";
import { safeReturnTo } from "../lib/auth-redirect";
import { validateEnvironment } from "../lib/environment";
test.each([
  "https://evil.test",
  "//evil.test",
  "/%2f%2fevil.test",
  "/\\evil.test",
  "/api/auth/logout",
])("rejects hostile callback %s", (value) =>
  expect(safeReturnTo(value)).toBe("/"),
);
test("preserves dashboard query context", () =>
  expect(safeReturnTo("/?view=inventory&location=S1")).toBe(
    "/?view=inventory&location=S1",
  ));
test("hosted mode cannot silently fall back to demo", () => {
  expect(() => validateEnvironment({ NETLIFY: "true" })).toThrow();
  expect(validateEnvironment({ NEXT_PUBLIC_DATA_MODE: "demo" }).mode).toBe(
    "demo",
  );
  expect(() =>
    validateEnvironment({ NEXT_PUBLIC_DATA_MODE: "convex" }),
  ).toThrow();
});
