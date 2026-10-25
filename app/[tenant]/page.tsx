import Link from "next/link";
import { notFound } from "next/navigation";
import { getTenantBySlug, tenants } from "@/lib/tenant-data";
import { StorefrontBrand } from "@/components/storefront-brand";
import { ProductCatalog } from "@/components/product-catalog";
import { HeroImageGallery } from "@/components/hero-image-gallery";
import { StorefrontCartButton, StorefrontCartProvider } from "@/components/storefront-cart";

type TenantPageProps = {
  params: Promise<{ tenant: string }>;
};

export function generateStaticParams() {
  return tenants.map((tenant) => ({ tenant: tenant.slug }));
}

export default async function TenantPage({ params }: TenantPageProps) {
  const { tenant } = await params;
  const storefront = getTenantBySlug(tenant);

  if (!storefront) {
    notFound();
  }

  return (
    <StorefrontCartProvider key={storefront.slug}>
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header
        className="border-b border-slate-200"
        style={{ backgroundColor: storefront.accentSoft }}
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <StorefrontBrand tenant={storefront} />
            <div className="min-w-0">
              <h1 className="text-lg font-bold leading-tight sm:text-2xl">{storefront.name}</h1>
            </div>
          </div>

          <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm font-medium text-slate-700 sm:justify-end">
            <Link className="py-1" href={`/${storefront.slug}`}>Home</Link>
            <Link className="py-1" href={`/${storefront.slug}#products`}>Products</Link>
            <Link className="py-1" href={`/${storefront.slug}#about`}>About</Link>
            <Link className="py-1" href="/admin">Admin</Link>
            <StorefrontCartButton accent={storefront.accent} currency={storefront.currency} />
          </nav>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 sm:py-12 md:grid-cols-[1.2fr_0.8fr] md:items-center">
        <div className="min-w-0">
          <h2 className="text-4xl font-black tracking-tight text-slate-900 sm:text-5xl md:text-6xl">
            {storefront.tagline}
          </h2>
          <p className="mt-5 max-w-lg text-lg text-slate-700">{storefront.description}</p>
        </div>

        <HeroImageGallery
          tenantSlug={storefront.slug}
          tenantName={storefront.name}
          fallbackImage={storefront.heroImage}
        />
      </section>

      <ProductCatalog
        tenantSlug={storefront.slug}
        currency={storefront.currency}
        accent={storefront.accent}
        accentSoft={storefront.accentSoft}
      />

      <section id="about" className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="grid min-w-0 gap-6 rounded-3xl border border-slate-200 bg-white p-5 sm:p-8 md:grid-cols-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">About</p>
            <h3 className="mt-2 text-2xl font-bold text-slate-900">Local-first, tenant-aware.</h3>
          </div>
          <div className="text-slate-700 md:col-span-2">
            <p>
              This storefront runs from the same core application as every other tenant in the platform,
              while keeping brand, theme, inventory, and storefront rules scoped to {storefront.name}.
            </p>
            <div className="mt-5 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <span className="block font-semibold text-slate-900">Location</span>
                {storefront.address}
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <span className="block font-semibold text-slate-900">Contact</span>
                {storefront.phone}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
    </StorefrontCartProvider>
  );
}
