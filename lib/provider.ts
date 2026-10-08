import type { DataProvider, Dataset } from "./types";
import type { CatalogueInput } from "./catalogue-input";
import { addDemoProduct } from "./demo-catalogue";
let cached: Promise<Dataset> | null = null;
export const fixtureProvider: DataProvider & {
  createProduct(
    input: CatalogueInput,
    idempotencyKey?: string,
  ): Promise<Dataset>;
  reset(): Promise<Dataset>;
} = {
  load() {
    if (process.env.NEXT_PUBLIC_DATA_MODE === "convex")
      return Promise.reject(
        new Error("Fixture data is unavailable in authenticated mode."),
      );
    if (!cached)
      cached = fetch("/mock-data.json")
        .then((r) => {
          if (!r.ok)
            throw new Error(
              "The demo dataset could not be loaded. Please retry.",
            );
          return r.json() as Promise<Dataset>;
        })
        .then((data) => {
          if (typeof window !== "undefined") {
            try {
              const additions = JSON.parse(
                localStorage.getItem("loom-demo-products") || "[]",
              ) as CatalogueInput[];
              for (const input of additions) data = addDemoProduct(data, input);
            } catch {
              localStorage.removeItem("loom-demo-products");
            }
          }
          return data;
        })
        .catch((e) => {
          cached = null;
          throw e;
        });
    return cached;
  },
  async createProduct(input) {
    const next = addDemoProduct(await this.load(), input);
    const additions = JSON.parse(
      localStorage.getItem("loom-demo-products") || "[]",
    );
    localStorage.setItem(
      "loom-demo-products",
      JSON.stringify([...additions, input]),
    );
    cached = Promise.resolve(next);
    return next;
  },
  async reset() {
    localStorage.removeItem("loom-demo-products");
    cached = null;
    return this.load();
  },
};
