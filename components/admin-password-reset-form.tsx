"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function AdminPasswordResetForm() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (password.length < 12) {
      setError("Use a password with at least 12 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/admin/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword: password }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Password update failed.");
        return;
      }

      setCurrentPassword("");
      setPassword("");
      setConfirmPassword("");
      setNotice("Your password has been updated. Sign in with your new password.");
      window.setTimeout(() => router.replace("/admin"), 1200);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Password update failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="mt-8 grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      onSubmit={handleSubmit}
    >
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
          {notice}
        </p>
      )}
      <label className="grid gap-1 text-sm font-medium">
        Current password (leave blank for first sign-in)
        <input
          autoComplete="current-password"
          className="rounded-lg border border-slate-300 px-3 py-2"
          type="password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
        />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        New password
        <input
          autoComplete="new-password"
          className="rounded-lg border border-slate-300 px-3 py-2"
          type="password"
          minLength={12}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Confirm new password
        <input
          autoComplete="new-password"
          className="rounded-lg border border-slate-300 px-3 py-2"
          type="password"
          minLength={12}
          required
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />
      </label>
      <button
        className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-50"
        type="submit"
        disabled={busy}
      >
        {busy ? "Updating password..." : "Update password"}
      </button>
    </form>
  );
}
