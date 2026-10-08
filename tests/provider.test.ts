import { test, expect } from "vitest";
import fixture from "../data/mock-data.json";
import type { Dataset } from "../lib/types";
import { addDemoProduct } from "../lib/demo-catalogue";
const input = {
  sku: "NEW-001",
  name: "New dress",
  category: "Dresses",
  color: "Blue",
  fabric: "Cotton",
  craft: "Printed",
  kurtaLength: 42,
  style: "Straight",
  collection: "Demo",
  season: "Festive 2026",
  launchDate: "2026-10-06",
  costMinor: 150000,
  suggestedMrpMinor: 300000,
  sizes: ["S", "M"],
  images: [],
};
test("new demo dress creates variants and no invented stock", () => {
  const d = fixture as Dataset,
    next = addDemoProduct(d, input);
  expect(next.products.length).toBe(31);
  expect(next.variants.length).toBe(152);
  expect(next.balances).toEqual(d.balances);
  expect(next.movements).toEqual(d.movements);
  expect(d.products.length).toBe(30);
  expect(() => addDemoProduct(next, input)).toThrow("SKU");
});
