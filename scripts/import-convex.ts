import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { loadEnvConfig } from "@next/env";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { inputTypes } from "../convex/domain/imports";
async function main() {
  loadEnvConfig(process.cwd());
  const url = process.env.NEXT_PUBLIC_CONVEX_URL,
    token = process.env.CONVEX_IMPORT_TOKEN,
    organizationId = process.env.IMPORT_ORGANIZATION_ID as
      Id<"organizations"> | undefined;
  const cutoff = process.argv
    .find((a) => a.startsWith("--cutoff="))
    ?.split("=")[1];
  if (!url || !token || !organizationId || !cutoff)
    throw new Error(
      "Set the backend URL, temporary administrator CONVEX_IMPORT_TOKEN, IMPORT_ORGANIZATION_ID and --cutoff=YYYY-MM-DD.",
    );
  const directory = resolve(
    process.argv.find((a) => a.startsWith("--directory="))?.split("=")[1] ??
      "data/normalized",
  );
  const manifest = JSON.parse(
    readFileSync(resolve(directory, "manifest.json"), "utf8"),
  );
  if (
    process.env.DEPLOYMENT_ENV === "production" &&
    manifest.synthetic &&
    process.env.ALLOW_SYNTHETIC_SEED !== "true"
  )
    throw new Error("Synthetic production import requires an explicit guard.");
  const client = new ConvexHttpClient(url);
  client.setAuth(token);
  const sourceHash = createHash("sha256")
    .update(JSON.stringify(manifest))
    .digest("hex");
  const counts = Object.fromEntries(
    manifest.load_order
      .filter((t: string) => t !== "organizations")
      .map((t: string) => [t, manifest.files[t].rows]),
  );
  const batch = await client.mutation(api.imports.create, {
    organizationId,
    sourceHash,
    asOf: manifest.as_of,
    cutoff,
    expectedCounts: counts,
    inputTypes: [...inputTypes],
    idempotencyKey: sourceHash,
  });
  const prior = await client.query(api.imports.status, {
    organizationId,
    batchId: batch.batchId,
  });
  if (prior.status === "staged")
    for (const table of manifest.load_order.filter(
      (t: string) => t !== "organizations",
    )) {
      const content = readFileSync(
        resolve(directory, manifest.files[table].path),
        "utf8",
      );
      if (
        createHash("sha256").update(content).digest("hex") !==
        manifest.files[table].sha256
      )
        throw new Error(`Checksum mismatch for ${table}`);
      const rows = content.trim()
        ? content
            .trim()
            .split("\n")
            .map((r: string) => JSON.parse(r))
        : [];
      for (let offset = 0; offset < rows.length; offset += 100)
        await client.mutation(api.imports.stageChunk, {
          organizationId,
          batchId: batch.batchId,
          table,
          chunkKey: String(offset),
          rows: JSON.stringify(rows.slice(offset, offset + 100)),
        });
      console.log(`${table}: staged ${rows.length}`);
    }
  if (prior.status === "staged")
    await client.mutation(api.imports.validate, {
      organizationId,
      batchId: batch.batchId,
    });
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    const status = await client.query(api.imports.status, {
      organizationId,
      batchId: batch.batchId,
    });
    if (status.status === "failed")
      throw new Error(status.cursor ?? "Validation failed");
    if (status.status === "ready") {
      console.log("Activated. Batch:", batch.batchId);
      return;
    }
    if (status.status === "validated") {
      console.log("Validated. Batch:", batch.batchId);
      if (process.argv.includes("--commit"))
        console.log(
          await client.mutation(api.imports.commit, {
            organizationId,
            batchId: batch.batchId,
          }),
        );
      process.exit(0);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(
    "Validation still running. Check batch status before retrying.",
  );
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Import failed");
  process.exitCode = 1;
});
