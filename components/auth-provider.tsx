"use client";
import { useState, type ReactNode } from "react";
import { ConvexReactClient } from "convex/react";
import {
  ConvexBetterAuthProvider,
  type AuthClient,
} from "@convex-dev/better-auth/react";
import { authClient } from "@/lib/auth-client";
export function AuthProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() =>
    process.env.NEXT_PUBLIC_DATA_MODE === "convex" &&
    process.env.NEXT_PUBLIC_CONVEX_URL
      ? new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL)
      : null,
  );
  return client ? (
    <ConvexBetterAuthProvider
      client={client}
      authClient={authClient as unknown as AuthClient}
    >
      {children}
    </ConvexBetterAuthProvider>
  ) : (
    children
  );
}
