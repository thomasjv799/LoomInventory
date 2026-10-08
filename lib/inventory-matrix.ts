import type { PreparedReport, ReportRow } from "./report-types";
export function inventoryMatrix(report: PreparedReport): PreparedReport {
  const sizes = [...new Set(report.rows.map((r) => String(r.size)))];
  const preferred = ["XS", "S", "M", "L", "XL", "XXL", "3XL", "Free size"];
  sizes.sort((a, b) => preferred.indexOf(a) - preferred.indexOf(b));
  const groups = new Map<string, ReportRow>();
  for (const row of report.rows) {
    const key = String(row.productId) + ":" + row.locationId;
    const group = groups.get(key) ?? {
      id: key,
      productId: row.productId,
      name: row.name,
      image: row.image,
      location: row.location,
      available: 0,
      inTransit: 0,
    };
    group["size_" + row.size] = row.available;
    group.available = Number(group.available) + Number(row.available);
    group.inTransit = Number(group.inTransit) + Number(row.inTransit);
    groups.set(key, group);
  }
  return {
    ...report,
    rows: [...groups.values()],
    columns: [
      { key: "name", label: "Style" },
      { key: "location", label: "Location" },
      ...sizes.map((size) => ({ key: "size_" + size, label: size })),
      { key: "available", label: "Available total" },
      { key: "inTransit", label: "In transit" },
    ],
    notes: [
      ...report.notes,
      "Size cells show available units. A dash means the size is outside the current filtered report, rather than zero stock.",
    ],
  };
}
