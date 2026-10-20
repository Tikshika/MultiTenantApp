import { AdminProductManager } from "@/components/admin-product-manager";
import { tenants } from "@/lib/tenant-data";

export default function AdminProductsPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-6 py-12 text-slate-900">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-bold">Product administration</h1>
        <p className="mt-2 text-slate-600">
          Add products and upload images to the store&apos;s Supabase Storage bucket.
        </p>
        <AdminProductManager tenantSlug={tenants[0].slug} />
      </div>
    </main>
  );
}
