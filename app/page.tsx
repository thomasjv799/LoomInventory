import { Suspense } from "react";
import Dashboard from "@/components/dashboard";
import { WorkspaceGate } from "@/components/workspace-gate";
import ConvexDashboard from "@/components/convex-dashboard";
import { validateEnvironment } from "@/lib/environment";
export default function Page() {
  let mode: "demo" | "convex";
  try {
    mode = validateEnvironment(process.env).mode;
  } catch {
    return (
      <main className="loading-screen">
        Workspace configuration is incomplete. Inventory is unavailable until
        setup is finished.
      </main>
    );
  }
  return (
    <Suspense
      fallback={
        <main className="loading-screen">Opening Inventory Studio…</main>
      }
    >
      {mode === "convex" ? (
        <WorkspaceGate>
          <ConvexDashboard />
        </WorkspaceGate>
      ) : (
        <Dashboard />
      )}
    </Suspense>
  );
}
