import type { Filters } from "./types";
import type { ReportName } from "./report-types";
export function filtersForReport(name: ReportName, filters: Filters) {
  const attributes = ["q", "category", "fabric", "color", "craft"];
  const inventory = [...attributes, "location", "size", "status"];
  const supported: Record<ReportName, string[]> = {
    overview: inventory,
    inventory,
    "slow-stock": inventory,
    "ho-shortages": [...attributes, "size", "status"],
    stores: [...attributes, "location"],
    rotation: [...attributes, "location", "size"],
    replenishment: [...attributes, "location", "size"],
    sales: [...attributes, "location", "size", "channel", "from", "to"],
    "size-packs": inventory,
    forecasts: [...attributes, "size"],
    events: [...attributes, "location", "size", "channel", "from", "to"],
    dupatta: [...attributes, "location", "size", "channel", "from", "to"],
  };
  return {
    applied: Object.fromEntries(
      Object.entries(filters).filter(([key]) => supported[name].includes(key)),
    ) as Filters,
    ignored: Object.keys(filters).filter(
      (key) => !supported[name].includes(key),
    ),
  };
}
