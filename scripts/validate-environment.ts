import { loadEnvConfig } from "@next/env";
import { validateEnvironment } from "../lib/environment";
loadEnvConfig(process.cwd());
console.log(
  `Environment valid for ${validateEnvironment(process.env).mode} mode.`,
);
