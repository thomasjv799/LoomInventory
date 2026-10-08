import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
const manifest = JSON.parse(
  readFileSync("data/normalized/manifest.json", "utf8"),
);
const run = (name: string, args: unknown) => {
  const result = spawnSync(
    "npx",
    ["convex", "run", name, JSON.stringify(args)],
    { encoding: "utf8" },
  );
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return JSON.parse(result.stdout);
};
mkdirSync(".convex", { recursive: true });
const statePath = ".convex/seed-state.json";
const sourceHash = createHash("sha256")
  .update(JSON.stringify(manifest))
  .digest("hex");
const state = existsSync(statePath)
  ? JSON.parse(readFileSync(statePath, "utf8"))
  : run("seed:begin", { sourceHash, asOf: manifest.as_of });
writeFileSync(statePath, JSON.stringify(state));
for (const table of manifest.load_order.filter(
  (name: string) => name !== "organizations",
)) {
  const content = readFileSync(`data/normalized/${table}.jsonl`, "utf8");
  if (
    createHash("sha256").update(content).digest("hex") !==
    manifest.files[table].sha256
  )
    throw new Error(`Checksum failed: ${table}`);
  const rows = content
    .trim()
    .split("\n")
    .map((line: string) => JSON.parse(line));
  for (let offset = 0; offset < rows.length; offset += 100)
    run("seed:stageChunk", {
      ...state,
      table,
      chunkKey: String(offset),
      rows: JSON.stringify(rows.slice(offset, offset + 100)),
    });
  console.log(`${table}: ${rows.length} staged`);
}
console.log(
  "Seed staged. Validate and activate this dataset version explicitly; no automatic reset or activation.",
  state.datasetVersionId,
);
if (process.argv.includes("--activate")) {
  const version = run("imports:version", {
    datasetVersionId: state.datasetVersionId,
  });
  if (version.status !== "ready")
    console.log(
      "Reconciliation:",
      run("imports:validateVersion", {
        datasetVersionId: state.datasetVersionId,
      }),
    );
  if (version.status !== "ready")
    console.log(
      "Activation:",
      run("imports:activate", {
        datasetVersionId: state.datasetVersionId,
        expectedSourceWatermark: version.baseWatermark,
      }),
    );
  else console.log("Existing ready version preserved. No reset performed.");
}
