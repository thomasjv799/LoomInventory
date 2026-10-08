import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";
export function authServer() {
  if (
    !process.env.NEXT_PUBLIC_CONVEX_URL ||
    !process.env.NEXT_PUBLIC_CONVEX_SITE_URL
  )
    throw new Error("Authentication is not configured");
  return convexBetterAuthNextJs({
    convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL,
    convexSiteUrl: process.env.NEXT_PUBLIC_CONVEX_SITE_URL,
  });
}
