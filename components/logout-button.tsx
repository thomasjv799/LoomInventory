"use client";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { logoutWorkspace } from "@/lib/logout";
import { Button } from "./ui/button";

export function LogoutButton() {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  async function logout() {
    setPending(true);
    setFailed(false);
    try {
      await logoutWorkspace(
        process.env.NEXT_PUBLIC_DATA_MODE === "convex",
        () => authClient.signOut(),
        (path) => window.location.replace(path),
      );
    } catch {
      setFailed(true);
      setPending(false);
    }
  }
  return (
    <div className="logout-control">
      <Button variant="ghost" size="sm" disabled={pending} onClick={logout}>
        <LogOut size={14} aria-hidden="true" />
        {pending ? "Logging out…" : "Log out"}
      </Button>
      {failed && (
        <span className="logout-error" role="alert">
          Could not log out. Please try again.
        </span>
      )}
    </div>
  );
}
