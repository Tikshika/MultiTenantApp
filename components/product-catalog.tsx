"use client";

import { useEffect, useState } from "react";

type ProductCatalogProps = {
  tenantSlug: string;
  currency: string;
  accent: string;
  accentSoft: string;
};

type Product = {
  id: number;
  name: string;
  description: string | null;
  price: number;
  stock_qty: number;
  image_url: string | null;
};

export function ProductCatalog({ tenantSlug, currency, accent, accentSoft }: ProductCatalogProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadProducts() {
      try {
        const response = await fetch(`/api/storefront/${tenantSlug}/products`, { cache: "no-store" });
        const result = (await response.json()) as { products?: Product[]; error?: string };
        if (!response.ok) throw new Error(result.error ?? "Could not load products.");
        if (!cancelled) setProducts(result.products ?? []);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load products.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadProducts();
    return () => {
      cancelled = true;
    };
  }, [tenantSlug]);

  return (
    <section id="products" className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Products</p>
        <h3 className="mt-2 text-3xl font-bold text-slate-900">Available products</h3>
      </div>

      {loading ? (
        <p className="rounded-2xl bg-white p-6 text-slate-600">Loading products...</p>
      ) : error ? (
        <p role="alert" className="rounded-2xl bg-red-50 p-6 text-red-800">
          {error}
        </p>
      ) : products.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-slate-600">
          No products are available yet. Products added by the store admin will appear here.
        </p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {products.map((product) => (
            <article key={product.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} className="h-48 w-full object-cover" />
              ) : (
                <div
                  className="flex h-48 items-center justify-center text-sm font-semibold text-slate-700"
                  style={{ background: `linear-gradient(135deg, ${accent}, ${accentSoft})` }}
                >
                  No product image
                </div>
              )}
              <div className="p-4">
                <h4 className="text-lg font-semibold text-slate-900">{product.name}</h4>
                {product.description && <p className="mt-2 text-sm text-slate-600">{product.description}</p>}
                <p className="mt-4 text-xl font-bold" style={{ color: accent }}>
                  {currency} {product.price}
                </p>
                <p className="mt-1 text-sm text-slate-500">{product.stock_qty} in stock</p>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
