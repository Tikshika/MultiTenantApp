import { AdminPasswordResetForm } from "@/components/admin-password-reset-form";

export default function AdminResetPasswordPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-6 py-12 text-slate-900">
      <div className="mx-auto max-w-md">
        <h1 className="text-3xl font-bold">Set a new password</h1>
        <p className="mt-2 text-slate-600">
          Enter a new password for your admin account.
        </p>
        <AdminPasswordResetForm />
      </div>
    </main>
  );
}
