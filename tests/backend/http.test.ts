import { test, expect } from "vitest";
import { ConvexError } from "convex/values";
import { errorResponse } from "../../convex/domain/http";
test.each([
  ["UNAUTHENTICATED", 401],
  ["FORBIDDEN", 403],
  ["INVALID_INPUT", 422],
  ["NOT_FOUND", 404],
  ["CONFLICT", 409],
  ["INSUFFICIENT_STOCK", 409],
])("maps %s to %s", (code, status) =>
  expect(
    errorResponse(new ConvexError({ code, message: "Safe error" }), "r").status,
  ).toBe(status),
);
test("hides internal error details", async () =>
  expect(
    await errorResponse(new Error("secret configuration value"), "r").text(),
  ).not.toContain("secret configuration"));
import { workspace, productInput } from "./fixtures";
test("HTTP and native catalogue results agree and malformed JSON is rejected", async () => {
  const { t, signed, organizationId } = await workspace();
  expect(
    (await t.fetch("/api/v1/products?organizationId=" + organizationId)).status,
  ).toBe(401);
  const created = await signed.fetch("/api/v1/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      organizationId,
      input: productInput,
      idempotencyKey: "http-create",
    }),
  });
  expect(created.status).toBe(200);
  const json = await created.json();
  expect(json.data.stock).toBe(0);
  const response = await signed.fetch(
    "/api/v1/products/" +
      json.data.productId +
      "?organizationId=" +
      organizationId,
  );
  expect(response.status).toBe(200);
  expect((await response.json()).data.product.sku).toBe(productInput.sku);
  expect(
    (
      await signed.fetch("/api/v1/products", {
        method: "POST",
        body: "{malformed",
      })
    ).status,
  ).toBe(422);
});
