"use client";
import { type ReactNode, useEffect, useState } from "react";
import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { LogoutButton } from "./logout-button";
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
  const joinGoogle = useMutation(api.googleAccess.join);
  const [accessChecked, setAccessChecked] = useState(false);
  const [accessError, setAccessError] = useState(false);
  useEffect(() => {
    if (!isAuthenticated || me === undefined || me.memberships.length) return;
    let cancelled = false;
    setAccessChecked(false);
    setAccessError(false);
    joinGoogle()
      .then(() => {
        if (!cancelled) setAccessChecked(true);
      })
      .catch(() => {
        if (!cancelled) {
          setAccessError(true);
          setAccessChecked(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, me?.user.id, me?.memberships.length, joinGoogle]);
  useEffect(() => {
    if (!isLoading && !isAuthenticated)
      router.replace(
        "/login?returnTo=" +
          encodeURIComponent(window.location.pathname + window.location.search),
      );
  }, [isLoading, isAuthenticated, router]);
  if (
    isLoading ||
    !isAuthenticated ||
    me === undefined ||
    (!me.memberships.length && !accessChecked)
  )
    return <main className="loading-screen">Checking workspace access…</main>;
  if (!me.memberships.length)
    return (
      <main className="login-page">
        <section className="login-card">
          <h1>{accessError ? "Could not check access" : "Access pending"}</h1>
          {accessError && (
            <button
              className="login-provider"
              onClick={() => window.location.reload()}
            >
              Try again
            </button>
          )}
          <p>
            Your account is signed in. Ask your administrator to grant workspace
            access.
          </p>
          <LogoutButton />
        </section>
      </main>
    );
  return children;
}
