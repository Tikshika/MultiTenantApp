"use client";

import { useEffect, useState } from "react";
import { useStorefrontCart } from "@/components/storefront-cart";

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
  const { addToCart, removeFromCart, quantityInCart } = useStorefrontCart();

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
                {quantityInCart(product.id) > 0 ? (
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div
                      className="flex items-center overflow-hidden rounded-xl border border-slate-200"
                      aria-label={`${product.name} quantity controls`}
                    >
                      <button
                        type="button"
                        onClick={() => removeFromCart(product.id)}
                        aria-label={`Remove one ${product.name}`}
                        className="px-4 py-2.5 text-lg font-semibold transition hover:bg-slate-100"
                      >
                        −
                      </button>
                      <span
                        aria-live="polite"
                        aria-label={`${quantityInCart(product.id)} added`}
                        className="min-w-10 text-center font-semibold text-slate-900"
                      >
                        {quantityInCart(product.id)}
                      </span>
                      <button
                        type="button"
                        onClick={() => addToCart(product, product.stock_qty)}
                        disabled={quantityInCart(product.id) >= product.stock_qty}
                        aria-label={`Add one ${product.name}`}
                        className="px-4 py-2.5 text-lg font-semibold transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-sm font-medium text-slate-600">
                      {quantityInCart(product.id) >= product.stock_qty ? "Stock limit reached" : "In cart"}
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => addToCart(product, product.stock_qty)}
                    disabled={product.stock_qty <= 0}
                    className="mt-4 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 disabled:shadow-none"
                    style={{ backgroundColor: product.stock_qty <= 0 ? "#cbd5e1" : accent }}
                  >
                    {product.stock_qty <= 0 ? "Out of stock" : "Add to cart"}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
