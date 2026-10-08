import { filterInventory, filterSales } from "./analytics";
import type { Dataset, Filters, Settings } from "./types";

export type Facet =
  | "location"
  | "channel"
  | "category"
  | "fabric"
  | "color"
  | "craft"
  | "size"
  | "status";

/** Count real matching records while removing only the facet being evaluated.
 * Incompatible choices stay visible but disabled. Deep-linked/search/date empty
 * results remain honest: this never broadens a user's selected report scope.
 */
export function facetCounts(
  data: Dataset,
  filters: Filters,
  settings: Settings,
  view: string,
  facet: Facet,
): Map<string, number> {
  const scope = { ...filters, [facet]: undefined };
  const products = new Map(data.products.map((p) => [p.id, p]));
  const variants = new Map(data.variants.map((v) => [v.id, v]));
  const counts = new Map<string, number>();
  const add = (value: string) =>
    counts.set(value, (counts.get(value) || 0) + 1);
  let records: {
    productId: string;
    size: string;
    locationId: string;
    status?: string;
  }[];
  if (view === "sales") {
    records = filterSales(data, scope).map((s) => ({
      productId: s.productId,
      size: variants.get(s.variantId)!.size,
      locationId: s.locationId,
    }));
  } else {
    const mapped = new Set(data.matchingRelationships.map((r) => r.outfitId));
    records = filterInventory(data, scope, settings).filter(
      (r) =>
        (view !== "stores" ||
          (r.locationId !== "HO" && r.product.category !== "Dupattas")) &&
        (view !== "dupatta" || mapped.has(r.productId)),
    );
  }
  for (const r of records) {
    if (facet === "location") add(r.locationId);
    else if (facet === "channel")
      add(r.locationId === "HO" ? "Ecommerce" : "Store");
    else if (facet === "size") add(r.size);
    else if (facet !== "status") add(products.get(r.productId)![facet]);
  }
  if (facet === "status") {
    for (const status of [
      "Healthy",
      "Low stock",
      "Stockout",
      "Selling stockout",
      "Inactive",
    ]) {
      counts.set(
        status,
        filterInventory(data, { ...scope, status }, settings).length,
      );
    }
  }
  return counts;
}
