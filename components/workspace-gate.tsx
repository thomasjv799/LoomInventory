"use client";
import { type ReactNode, useEffect, useState } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
export function WorkspaceGate({ children }: { children: ReactNode }) {
  if (process.env.NEXT_PUBLIC_DATA_MODE !== "convex") return children;
  if (
    !process.env.NEXT_PUBLIC_CONVEX_URL ||
    !process.env.NEXT_PUBLIC_CONVEX_SITE_URL
  )
    return (
      <main className="loading-screen">
        Workspace sign-in needs configuration. Inventory is unavailable.
      </main>
    );
  return <AuthenticatedGate>{children}</AuthenticatedGate>;
}
function AuthenticatedGate({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const router = useRouter();
  const me = useQuery(api.memberships.me, isAuthenticated ? {} : "skip");
  useEffect(() => {
    if (!isLoading && !isAuthenticated)
      router.replace(
        "/login?returnTo=" +
          encodeURIComponent(window.location.pathname + window.location.search),
      );
  }, [isLoading, isAuthenticated, router]);
  if (isLoading || !isAuthenticated || me === undefined)
    return <main className="loading-screen">Checking workspace access…</main>;
  if (!me.memberships.length)
    return (
      <main className="login-page">
        <section className="login-card">
          <h1>Access pending</h1>
          <p>
            Your account is signed in. Ask your administrator to grant workspace
            access.
          </p>
          <button
            className="login-provider"
            onClick={async () => {
              await authClient.signOut();
              window.location.assign("/login");
            }}
          >
            Sign out
          </button>
        </section>
      </main>
    );
  return children;
}
