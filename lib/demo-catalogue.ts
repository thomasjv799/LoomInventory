import type { Dataset, Product } from "./types";
import type { CatalogueInput } from "./catalogue-input";
export function addDemoProduct(data: Dataset, input: CatalogueInput): Dataset {
  if (
    !input.sku.trim() ||
    !input.name.trim() ||
    data.products.some((p) => p.sku === input.sku)
  )
    throw new Error("Enter a new, unique product SKU and name.");
  if (!input.sizes.length || new Set(input.sizes).size !== input.sizes.length)
    throw new Error("Select at least one unique size.");
  for (const amount of [input.costMinor, input.suggestedMrpMinor])
    if (!Number.isSafeInteger(amount) || amount < 0)
      throw new Error("Enter valid cost and suggested MRP.");
  const id = "DEMO-" + encodeURIComponent(input.sku),
    image = input.images[0];
  const product: Product = {
    id,
    sku: input.sku,
    name: input.name,
    category: input.category,
    color: input.color,
    fabric: input.fabric,
    craft: input.craft,
    kurtaLength: input.kurtaLength,
    style: input.style,
    collection: input.collection,
    season: input.season,
    launchDate: input.launchDate,
    cost: input.costMinor,
    suggestedMrp: input.suggestedMrpMinor,
    image: image?.url ?? "",
    secondaryImage: input.images[1]?.url ?? null,
    sourceProductUrl: image?.sourceProductUrl ?? "",
    sizes: input.sizes,
    provenance: {
      attributes: "operator-entered demo",
      stock: "not received",
      image: "unverified operator reference",
    },
  };
  return {
    ...data,
    products: [...data.products, product],
    variants: [
      ...data.variants,
      ...input.sizes.map((size) => ({
        id: id + "-" + size,
        productId: id,
        sku: input.sku + "-" + size,
        size,
      })),
    ],
  };
}
