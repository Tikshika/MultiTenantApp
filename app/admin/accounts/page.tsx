import { AdminAccountsManager } from "@/components/admin-accounts-manager";

export default function AdminAccountsPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-6 py-12 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-bold">Admin account management</h1>
        <p className="mt-2 text-slate-600">
          Create and manage admin access. Temporary passwords are hashed and never shown again.
        </p>
        <AdminAccountsManager />
      </div>
    </main>
  );
}
