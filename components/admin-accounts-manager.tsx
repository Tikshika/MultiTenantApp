"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type AdminRole = "store_owner" | "super_admin";

type AdminAccount = {
  id: number;
  email: string;
  role: AdminRole;
  tenant_id: number | null;
  tenant_name: string | null;
  must_change_password: boolean;
  created_at: string;
};

type Tenant = {
  id: number;
  name: string;
  slug: string;
};

type AccountForm = {
  email: string;
  role: AdminRole;
  tenantId: string;
  temporaryPassword: string;
};

const emptyForm: AccountForm = {
  email: "",
  role: "store_owner",
  tenantId: "",
  temporaryPassword: "",
};

export function AdminAccountsManager() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [currentAdminId, setCurrentAdminId] = useState<number | null>(null);
  const [form, setForm] = useState<AccountForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadAccounts = useCallback(async () => {
    const response = await fetch("/api/admin/accounts", { cache: "no-store" });
    const result = (await response.json()) as {
      error?: string;
      accounts?: AdminAccount[];
      tenants?: Tenant[];
      currentAdminId?: number;
    };

    if (response.status === 401) {
      router.replace("/admin");
      return;
    }
    if (!response.ok) throw new Error(result.error ?? "Could not load admin accounts.");

    setAccounts(result.accounts ?? []);
    setTenants(result.tenants ?? []);
    setCurrentAdminId(result.currentAdminId ?? null);
  }, [router]);

  useEffect(() => {
    let active = true;
    void Promise.resolve()
      .then(loadAccounts)
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Could not load admin accounts.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadAccounts]);

  function startEditing(account: AdminAccount) {
    setEditingId(account.id);
    setForm({
      email: account.email,
      role: account.role,
      tenantId: account.tenant_id === null ? "" : String(account.tenant_id),
      temporaryPassword: "",
    });
    setError("");
    setNotice("");
  }

  function cancelEditing() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        editingId === null ? "/api/admin/accounts" : `/api/admin/accounts/${editingId}`,
        {
          method: editingId === null ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: form.email,
            role: form.role,
            tenantId: form.role === "store_owner" ? Number(form.tenantId) : null,
            ...(form.temporaryPassword ? { temporaryPassword: form.temporaryPassword } : {}),
          }),
        },
      );
      const result = (await response.json()) as { error?: string; passwordReset?: boolean };
      if (!response.ok) throw new Error(result.error ?? "Could not save the admin account.");

      setNotice(
        editingId === null
          ? "Admin account created. Share the temporary password securely; the user must change it at sign-in."
          : result.passwordReset
            ? "Admin account updated. Its sessions were revoked; the user must change the temporary password at sign-in."
            : "Admin account updated.",
      );
      cancelEditing();
      await loadAccounts();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save the admin account.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(account: AdminAccount) {
    if (!window.confirm(`Delete the admin account for ${account.email}? This will revoke its sessions.`)) return;

    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/accounts/${account.id}`, { method: "DELETE" });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not delete the admin account.");
      setNotice("Admin account deleted.");
      if (editingId === account.id) cancelEditing();
      await loadAccounts();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete the admin account.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/logout", { method: "POST" });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Sign-out failed.");
      router.replace("/admin");
    } catch (signOutError) {
      setError(signOutError instanceof Error ? signOutError.message : "Sign-out failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/products" className="text-sm font-semibold text-amber-800 underline">
          Back to product administration
        </Link>
        <button
          type="button"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
          disabled={busy}
          onClick={() => void handleSignOut()}
        >
          Sign out
        </button>
      </div>

      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{notice}</p>}

      <form onSubmit={handleSubmit} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2">
        <h2 className="text-xl font-semibold md:col-span-2">
          {editingId === null ? "Create admin account" : "Edit admin account"}
        </h2>
        <label className="grid gap-1 text-sm font-medium">
          Email
          <input
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Role
          <select
            value={form.role}
            onChange={(event) => setForm({ ...form, role: event.target.value as AdminRole })}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2"
          >
            <option value="store_owner">Store owner</option>
            <option value="super_admin">Super admin</option>
          </select>
        </label>
        {form.role === "store_owner" && (
          <label className="grid gap-1 text-sm font-medium">
            Store
            <select
              required
              value={form.tenantId}
              onChange={(event) => setForm({ ...form, tenantId: event.target.value })}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2"
            >
              <option value="">Select a store</option>
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>{tenant.name} ({tenant.slug})</option>
              ))}
            </select>
          </label>
        )}
        <label className="grid gap-1 text-sm font-medium">
          {editingId === null ? "Temporary password" : "Set temporary password (optional)"}
          <input
            type="password"
            autoComplete="new-password"
            required={editingId === null}
            minLength={12}
            maxLength={1024}
            value={form.temporaryPassword}
            onChange={(event) => setForm({ ...form, temporaryPassword: event.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2"
          />
          <span className="text-xs font-normal text-slate-500">
            At least 12 characters. The user must change it at next sign-in.
          </span>
        </label>
        <div className="flex gap-3 md:col-span-2">
          <button
            type="submit"
            disabled={busy || (form.role === "store_owner" && tenants.length === 0)}
            className="rounded-lg bg-amber-800 px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Saving..." : editingId === null ? "Create account" : "Save changes"}
          </button>
          {editingId !== null && (
            <button type="button" disabled={busy} onClick={cancelEditing} className="rounded-lg border border-slate-300 px-4 py-2 font-semibold">
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <p className="p-6 text-slate-600">Loading admin accounts...</p>
        ) : accounts.length === 0 ? (
          <p className="p-6 text-slate-600">No admin accounts found.</p>
        ) : (
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-5 py-3 font-semibold">Email</th>
                <th className="px-5 py-3 font-semibold">Role</th>
                <th className="px-5 py-3 font-semibold">Store</th>
                <th className="px-5 py-3 font-semibold">Password status</th>
                <th className="px-5 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {accounts.map((account) => (
                <tr key={account.id}>
                  <td className="px-5 py-4 font-medium">
                    {account.email}{account.id === currentAdminId ? " (you)" : ""}
                  </td>
                  <td className="px-5 py-4">{account.role === "super_admin" ? "Super admin" : "Store owner"}</td>
                  <td className="px-5 py-4">{account.tenant_name ?? "All stores"}</td>
                  <td className="px-5 py-4">
                    {account.must_change_password ? "Must change at sign-in" : "Active"}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex gap-3">
                      <button type="button" disabled={busy} onClick={() => startEditing(account)} className="font-semibold text-amber-800 underline">
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={busy || account.id === currentAdminId}
                        onClick={() => void handleDelete(account)}
                        className="font-semibold text-red-700 underline disabled:opacity-40"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
