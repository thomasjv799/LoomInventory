import { copyFileSync, existsSync, unlinkSync } from "node:fs";
import { loadEnvConfig } from "@next/env";
import { validateEnvironment } from "../lib/environment";
loadEnvConfig(process.cwd());
const { mode } = validateEnvironment(process.env);
if (mode === "convex") {
  if (existsSync("public/mock-data.json")) unlinkSync("public/mock-data.json");
} else copyFileSync("data/mock-data.json", "public/mock-data.json");
console.log(
  `Prepared ${mode} assets. ${mode === "convex" ? "Public fixture file excluded." : "Synthetic local fixture included."}`,
);
