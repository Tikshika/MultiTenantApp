"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let active = true;
    void fetch("/api/admin/session", { cache: "no-store" })
      .then(async (response) => {
        if (response.ok) {
          const session = (await response.json()) as { mustChangePassword?: boolean };
          router.replace(session.mustChangePassword ? "/admin/reset-password" : "/admin/products");
        } else if (response.status !== 401) {
          const result = (await response.json()) as { error?: string };
          if (active) setError(result.error ?? "Could not verify the admin session.");
        }
      })
      .catch((sessionError: unknown) => {
        if (active) setError(sessionError instanceof Error ? sessionError.message : "Could not verify the admin session.");
      })
      .finally(() => {
        if (active) setCheckingSession(false);
      });
    return () => {
      active = false;
    };
  }, [router]);

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result = (await response.json()) as { error?: string; mustChangePassword?: boolean };
      if (!response.ok) {
        setError(result.error ?? "Sign-in failed.");
        return;
      }

      setPassword("");
      router.replace(result.mustChangePassword ? "/admin/reset-password" : "/admin/products");
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : "Sign-in request failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="mt-8 grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" onSubmit={handleSignIn}>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
      <label className="grid gap-1 text-sm font-medium">
        Email
        <input
          autoComplete="username"
          className="rounded-lg border border-slate-300 px-3 py-2"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Password
        <input
          autoComplete="current-password"
          className="rounded-lg border border-slate-300 px-3 py-2"
          type="password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <button
        className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-50"
        type="submit"
        disabled={busy || checkingSession}
      >
        {busy ? "Signing in..." : "Sign in"}
      </button>
      <p className="text-sm text-slate-600">
        Forgot your password? Contact the system administrator to reset it.
      </p>
    </form>
  );
}
