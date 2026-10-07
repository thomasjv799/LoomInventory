import type { DataProvider, Dataset } from "./types";
let cached: Promise<Dataset> | null = null;
export const fixtureProvider: DataProvider = {
  load() {
    if (!cached)
      cached = fetch("/mock-data.json")
        .then((r) => {
          if (!r.ok)
            throw new Error(
              "The demo dataset could not be loaded. Please retry.",
            );
          return r.json() as Promise<Dataset>;
        })
        .catch((e) => {
          cached = null;
          throw e;
        });
    return cached;
  },
};
