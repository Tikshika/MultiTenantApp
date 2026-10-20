import Link from "next/link";
import { tenants } from "@/lib/tenant-data";
import { StorefrontBrand } from "@/components/storefront-brand";

export default function Home() {
  const tenant = tenants[0];

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto max-w-6xl px-6 py-16 md:py-20">
        <div className="mb-10 flex items-center justify-between gap-4">
          <StorefrontBrand tenant={tenant} tone="dark" detailsClassName="hidden sm:block" />
          <div className="flex items-center gap-5">
            <Link href="/admin" className="text-sm font-semibold text-white hover:text-amber-200">
              Admin
            </Link>
            <Link
              href={`/${tenant.slug}`}
              className="rounded-full bg-white px-6 py-3 text-base font-semibold text-slate-900 transition hover:bg-slate-200"
            >
              Open shop
            </Link>
          </div>
        </div>

        <div className="mb-12">
          <h1 className="text-5xl font-black tracking-tight md:text-7xl">{tenant.name}</h1>
        </div>

        <div className="overflow-hidden rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-sm">
          <div
            className="h-72 bg-cover bg-center md:h-96"
            style={{ backgroundImage: `url(${tenant.heroImage})` }}
          />

          <div className="grid gap-10 p-7 md:grid-cols-[1.2fr_0.8fr] md:p-10">
            <div>
              <span className="rounded-full bg-amber-200 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-900">
                {tenant.category}
              </span>
              <h2 className="mt-5 text-3xl font-bold leading-tight md:text-5xl">
                {tenant.tagline}
              </h2>
              <p className="mt-4 max-w-xl text-base leading-7 text-slate-300">{tenant.description}</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6">
              <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Location</p>
              <p className="mt-3 text-xl font-semibold">{tenant.address}</p>
              <p className="mt-5 text-sm uppercase tracking-[0.2em] text-slate-400">Contact</p>
              <p className="mt-3 text-xl font-semibold">{tenant.phone}</p>
            </div>
          </div>
        </div>

        <div className="mt-14 rounded-[28px] border border-white/10 bg-slate-900 p-7">
          <h3 className="text-3xl font-bold text-white">About us</h3>
          <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300">
            Sulthan Hardware has served homes, contractors, and businesses with durable materials,
            practical tools, and dependable service. From simple repairs to major projects, we help
            customers find the right solution with reliable quality and expert guidance.
          </p>

          <div className="mt-8 grid gap-5 border-t border-white/10 pt-6 sm:grid-cols-2">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Visit us</p>
              <p className="mt-2 text-lg font-semibold">{tenant.address}</p>
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Call</p>
              <p className="mt-2 text-lg font-semibold">{tenant.phone}</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
