"use client";
import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { safeReturnTo } from "@/lib/auth-redirect";
export function LoginForm() {
  const params = useSearchParams();
  const [pending, setPending] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    params.get("error")
      ? "Sign-in could not be completed. Please try again."
      : null,
  );
  const configured =
    process.env.NEXT_PUBLIC_DATA_MODE === "convex" &&
    !!process.env.NEXT_PUBLIC_CONVEX_URL &&
    !!process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  async function signInWithPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configured || pending) return;
    setPending("password");
    setError(null);
    try {
      const result = await authClient.signIn.email({
        email: email.trim(),
        password,
      });
      if (result.error) {
        setPassword("");
        setError(
          "Sign-in failed. Check your email and password, then try again.",
        );
        setPending(null);
        return;
      }
      setPassword("");
      window.location.replace(safeReturnTo(params.get("returnTo")));
    } catch {
      setPassword("");
      setError("Could not connect. Please try again.");
      setPending(null);
    }
  }
  async function signIn(provider: "google" | "microsoft") {
    setError(null);
    setPending(provider);
    try {
      const result = await authClient.signIn.social({
        provider,
        callbackURL: safeReturnTo(params.get("returnTo")),
        errorCallbackURL: "/login?error=signin",
      });
      if (result.error)
        throw new Error("Sign-in could not be completed. Please try again.");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Sign-in failed. Please try again.",
      );
      setPending(null);
    }
  }
  return (
    <main className="login-page">
      <a className="login-brand" href="/" aria-label="Inventory Studio home">
        <span className="login-mark">L</span>
        <span>
          THE LOOM<small>INVENTORY STUDIO</small>
        </span>
      </a>
      <section className="login-card" aria-labelledby="login-title">
        <h1 id="login-title">Sign in</h1>
        <form className="login-credentials" onSubmit={signInWithPassword}>
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={!configured || !!pending}
          />
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={!configured || !!pending}
          />
          <button
            className="login-submit"
            type="submit"
            disabled={!configured || !!pending}
          >
            {pending === "password" ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <div className="login-or" aria-hidden="true">
          or
        </div>
        <div className="login-options">
          <button
            disabled={!configured || !!pending}
            onClick={() => signIn("google")}
            className="login-provider"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M21.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.4a4.7 4.7 0 0 1-2 3.1v2.6h3.3c1.9-1.8 2.9-4.4 2.9-7.6Z"
              />
              <path
                fill="#34A853"
                d="M12 22c2.7 0 5-0.9 6.7-2.4l-3.3-2.6c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.2H3v2.7A10 10 0 0 0 12 22Z"
              />
              <path
                fill="#FBBC05"
                d="M6.4 13.8a6 6 0 0 1 0-3.6V7.5H3a10 10 0 0 0 0 9l3.4-2.7Z"
              />
              <path
                fill="#EA4335"
                d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3 7.5l3.4 2.7C7.2 7.8 9.4 6 12 6Z"
              />
            </svg>
            <span>Continue with Google</span>
            {pending === "google" ? (
              <LoaderCircle className="login-spinner" size={18} />
            ) : (
              <ArrowRight size={18} />
            )}
          </button>
          <button
            disabled={!configured || !!pending}
            onClick={() => signIn("microsoft")}
            className="login-provider"
          >
            <svg width="20" height="20" viewBox="0 0 21 21" aria-hidden="true">
              <path fill="#f25022" d="M0 0h10v10H0z" />
              <path fill="#7fba00" d="M11 0h10v10H11z" />
              <path fill="#00a4ef" d="M0 11h10v10H0z" />
              <path fill="#ffb900" d="M11 11h10v10H11z" />
            </svg>
            <span>Continue with Microsoft</span>
            {pending === "microsoft" ? (
              <LoaderCircle className="login-spinner" size={18} />
            ) : (
              <ArrowRight size={18} />
            )}
          </button>
        </div>
        {error && (
          <p className="login-notice error" role="alert">
            {error}
          </p>
        )}
        {!configured && (
          <div className="login-notice" role="status">
            Sign-in is not configured yet.
          </div>
        )}
      </section>
      <footer className="login-footer">The Loom · Inventory Studio</footer>
    </main>
  );
}
