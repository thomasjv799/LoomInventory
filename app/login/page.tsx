import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";
export default function LoginPage() {
  return (
    <Suspense
      fallback={<main className="loading-screen">Opening sign-in…</main>}
    >
      <LoginForm />
    </Suspense>
  );
}
