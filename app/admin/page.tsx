import { AdminLoginForm } from "@/components/admin-login-form";

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-6 py-12 text-slate-900">
      <div className="mx-auto max-w-md">
        <h1 className="text-3xl font-bold">Admin sign in</h1>
        <p className="mt-2 text-slate-600">Sign in with your authorized store admin credentials.</p>
        <AdminLoginForm />
      </div>
    </main>
  );
}
