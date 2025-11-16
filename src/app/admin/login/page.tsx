"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";

export default function AdminLoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const redirect = searchParams.get("redirect") ?? "/admin/hadith";

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Login failed");
      }
      router.replace(redirect);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-svh items-center justify-center bg-[var(--background)] px-4 text-[var(--text-primary)]">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-panel)] p-8 shadow-xl">
        <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-subtle)]">Admin</p>
        <h1 className="mt-2 text-2xl font-semibold">Secure login</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Enter the admin token from your environment to access the management console.
        </p>
        <form className="mt-6 flex flex-col gap-3" onSubmit={handleSubmit}>
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Admin token"
            type="password"
            className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-input)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none ring-1 ring-transparent transition focus:ring-[var(--accent-emerald)]"
          />
          {error && <p className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-[var(--accent-emerald)] px-4 py-2 text-center text-sm font-semibold text-[var(--accent-contrast)] shadow-md transition hover:-translate-y-0.5 disabled:opacity-50"
          >
            {loading ? "Validating…" : "Enter"}
          </button>
          <p className="text-center text-xs text-[var(--text-muted)]">
            Need access? Set ADMIN_TOKEN in .env.local and reload this page.
          </p>
        </form>
      </div>
    </main>
  );
}
