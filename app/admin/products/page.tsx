import { AdminProductManager } from "@/components/admin-product-manager";
import { tenants } from "@/lib/tenant-data";
import Link from "next/link";

export default function AdminProductsPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-6 py-12 text-slate-900">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-bold">Product administration</h1>
        <p className="mt-2 text-slate-600">
          Add products and upload images to the store&apos;s Supabase Storage bucket.
        </p>
        <Link href="/admin/hero-images" className="mt-4 inline-block font-semibold text-amber-800 underline">
          Manage storefront hero images
        </Link>
        <AdminProductManager tenantSlug={tenants[0].slug} />
      </div>
    </main>
  );
}
