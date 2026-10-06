import { Suspense } from "react";
import Dashboard from "@/components/dashboard";
export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="loading-screen">Opening Inventory Studio…</main>
      }
    >
      <Dashboard />
    </Suspense>
  );
}
