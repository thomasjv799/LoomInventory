export function validateEnvironment(env: Record<string, string | undefined>) {
  const mode = env.NEXT_PUBLIC_DATA_MODE || (env.NETLIFY ? "convex" : "demo");
  if (!["demo", "convex"].includes(mode))
    throw new Error("NEXT_PUBLIC_DATA_MODE must be demo or convex");
  if (env.NETLIFY && !env.NEXT_PUBLIC_DATA_MODE)
    throw new Error("Hosted builds require explicit NEXT_PUBLIC_DATA_MODE");
  if (env.NETLIFY && mode !== "convex")
    throw new Error("Public deployments require authenticated Convex mode");
  if (mode === "convex") {
    for (const key of [
      "NEXT_PUBLIC_CONVEX_URL",
      "NEXT_PUBLIC_CONVEX_SITE_URL",
      "NEXT_PUBLIC_SITE_URL",
    ]) {
      if (!env[key]) throw new Error(`Missing ${key}`);
      const url = new URL(env[key]!);
      if (
        url.protocol !== "https:" &&
        !(
          url.protocol === "http:" &&
          ["localhost", "127.0.0.1"].includes(url.hostname)
        )
      )
        throw new Error(`Invalid ${key}`);
    }
  }
  for (const key of Object.keys(env))
    if (
      key.startsWith("NEXT_PUBLIC_") &&
      /SECRET|DEPLOY_KEY|PASSWORD|PRIVATE_KEY/.test(key)
    )
      throw new Error("Secret cannot be public");
  return { mode: mode as "demo" | "convex" };
}
