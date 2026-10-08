import { test, expect } from "vitest";
import { filtersForReport } from "../lib/report-filters";
import { inventoryMatrix } from "../lib/inventory-matrix";
test("reports disclose irrelevant filters rather than pretending they changed a forecast", () => {
  expect(
    filtersForReport("forecasts", {
      location: "S1",
      channel: "Store",
      from: "2026-10-01",
      size: "M",
    }),
  ).toEqual({
    applied: { size: "M" },
    ignored: ["location", "channel", "from"],
  });
});
test("matrix groups the entire prepared run before pagination and retains unknown size cells", () => {
  const matrix = inventoryMatrix({
    rows: [
      {
        id: "a",
        productId: "p",
        name: "Dress",
        locationId: "s",
        location: "Delhi",
        size: "S",
        available: 2,
        inTransit: 1,
      },
      {
        id: "b",
        productId: "p",
        name: "Dress",
        locationId: "s",
        location: "Delhi",
        size: "M",
        available: 3,
        inTransit: 0,
      },
    ],
    columns: [],
    totals: { available: 5 },
    charts: [],
    notes: [],
  });
  expect(matrix.rows).toHaveLength(1);
  expect(matrix.rows[0]).toMatchObject({
    size_S: 2,
    size_M: 3,
    available: 5,
    inTransit: 1,
  });
  expect(matrix.rows[0].size_L).toBeUndefined();
});
