import { AdminHeroImageManager } from "@/components/admin-hero-image-manager";
import { tenants } from "@/lib/tenant-data";

export default function AdminHeroImagesPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-6 py-12 text-slate-900">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-3xl font-bold">Storefront image management</h1>
        <p className="mt-2 text-slate-600">
          Upload and arrange the images shown in the store&apos;s hero gallery.
        </p>
        <AdminHeroImageManager tenantSlug={tenants[0].slug} />
      </div>
    </main>
  );
}
