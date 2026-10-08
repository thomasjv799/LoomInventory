import { spawnSync } from "node:child_process";
if (process.env.NETLIFY !== "true")
  throw new Error(
    "This command is for Netlify builds only. Use npm run build locally.",
  );
const key = process.env.CONVEX_DEPLOY_KEY;
if (!key) throw new Error("Missing scoped CONVEX_DEPLOY_KEY");
const preview = process.env.CONTEXT !== "production";
if (preview && !key.startsWith("preview:"))
  throw new Error(
    "Preview builds require a separate Convex preview deploy key",
  );
if (!preview && !key.startsWith("prod:"))
  throw new Error("Production builds require a production Convex deploy key");
const child = spawnSync(
  "npx",
  [
    "convex",
    "deploy",
    "--cmd",
    "npm run build",
    "--cmd-url-env-var-name",
    "NEXT_PUBLIC_CONVEX_URL",
  ],
  {
    stdio: "inherit",
    env: { ...process.env, NEXT_PUBLIC_DATA_MODE: "convex" },
  },
);
process.exit(child.status ?? 1);
