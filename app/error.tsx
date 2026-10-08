"use client";
import { useEffect } from "react";
export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Workspace unavailable", error.digest ?? "request failed");
  }, [error]);
  return (
    <main className="login-page">
      <section className="login-card" role="alert">
        <h1>Workspace unavailable</h1>
        <p>
          Your access or data may have changed. Refresh to check your current
          permissions.
        </p>
        <button className="button" onClick={reset}>
          Try again
        </button>
        <a href="/login">Return to sign in</a>
      </section>
    </main>
  );
}
