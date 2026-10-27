"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { optimizeImageForUpload } from "@/lib/optimize-upload-image";

type AdminProductManagerProps = {
  tenantSlug: string;
};

type Product = {
  id: number;
  name: string;
  description: string | null;
  price: number;
  stock_qty: number;
  image_url: string | null;
  is_active: boolean;
};

type AdminSession = {
  id: number;
  email: string;
  role: "store_owner" | "super_admin";
  mustChangePassword: boolean;
};

export function AdminProductManager({ tenantSlug }: AdminProductManagerProps) {
  const router = useRouter();
  const [session, setSession] = useState<AdminSession | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [checkingSession, setCheckingSession] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [statusUpdatingProductId, setStatusUpdatingProductId] = useState<number | null>(null);

  const loadProducts = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/tenants/${tenantSlug}/products`, {
        cache: "no-store",
      });
      const result = (await response.json()) as { products?: Product[]; error?: string };
      if (!response.ok) {
        setError(result.error ?? "Could not load products.");
        setIsAuthorized(false);
        return;
      }

      setIsAuthorized(true);
      setError("");
      setProducts(result.products ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load products.");
      setIsAuthorized(false);
    }
  }, [tenantSlug]);

  useEffect(() => {
    let active = true;
    void fetch("/api/admin/session", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) {
          router.replace("/admin");
          return;
        }
        const result = (await response.json()) as AdminSession & { error?: string };
        if (!response.ok) {
          setError(result.error ?? "Could not verify the admin session.");
          return;
        }
        if (result.mustChangePassword) {
          router.replace("/admin/reset-password");
          return;
        }
        if (active) {
          setSession(result);
          await loadProducts();
        }
      })
      .catch((sessionError: unknown) => {
        if (active) {
          setError(sessionError instanceof Error ? sessionError.message : "Could not verify the admin session.");
        }
      })
      .finally(() => {
        if (active) setCheckingSession(false);
      });

    return () => {
      active = false;
    };
  }, [loadProducts, router]);

  async function handleSignOut() {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/logout", { method: "POST" });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Sign-out failed.");
        return;
      }
      router.replace("/admin");
    } catch (signOutError) {
      setError(signOutError instanceof Error ? signOutError.message : "Sign-out request failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const form = event.currentTarget;
    try {
      const formData = new FormData(form);
      const image = formData.get("image");
      if (image instanceof File && image.size > 0) {
        formData.set("image", await optimizeImageForUpload(image, 5 * 1024 * 1024));
      }

      const response = await fetch(
        editingProduct
          ? `/api/admin/tenants/${tenantSlug}/products/${editingProduct.id}`
          : `/api/admin/tenants/${tenantSlug}/products`,
        {
          method: editingProduct ? "PATCH" : "POST",
          body: formData,
        },
      );
      const result = (await response.json()) as { error?: string; warning?: string };

      if (!response.ok) {
        setError(result.error ?? "Product could not be saved.");
        return;
      }

      form.reset();
      setEditingProduct(null);
      setNotice(
        result.warning ??
          (editingProduct ? "Product updated successfully." : "Product and image uploaded successfully."),
      );
      await loadProducts();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Product save request failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleProductStatusChange(product: Product, isActive: boolean) {
    setStatusUpdatingProductId(product.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/tenants/${tenantSlug}/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: isActive }),
      });
      const result = (await response.json()) as { is_active?: boolean; error?: string };
      if (!response.ok || typeof result.is_active !== "boolean") {
        setError(result.error ?? "Product status could not be updated.");
        return;
      }

      const updatedIsActive = result.is_active;
      setProducts((currentProducts) =>
        currentProducts.map((currentProduct) =>
          currentProduct.id === product.id ? { ...currentProduct, is_active: updatedIsActive } : currentProduct,
        ),
      );
      setEditingProduct((currentProduct) =>
        currentProduct?.id === product.id ? { ...currentProduct, is_active: updatedIsActive } : currentProduct,
      );
      setNotice(`${product.name} is now ${updatedIsActive ? "active" : "inactive"}.`);
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Product status update request failed.");
    } finally {
      setStatusUpdatingProductId(null);
    }
  }

  async function handleDeleteProduct(product: Product) {
    if (
      !window.confirm(
        `Permanently delete "${product.name}"? This cannot be undone. Products with order or inventory history cannot be deleted.`,
      )
    ) {
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/tenants/${tenantSlug}/products/${product.id}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as { error?: string; warning?: string };
      if (!response.ok) throw new Error(result.error ?? "Product could not be deleted.");

      setProducts((currentProducts) => currentProducts.filter((item) => item.id !== product.id));
      setEditingProduct((currentProduct) => (currentProduct?.id === product.id ? null : currentProduct));
      setNotice(result.warning ?? `${product.name} was permanently deleted.`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Product deletion request failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      {error && (
        <p role="alert" className="mb-5 rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mb-5 rounded-lg bg-green-50 p-3 text-sm text-green-800">
          {notice}
        </p>
      )}

      {checkingSession ? (
        <p className="text-slate-600">Checking admin session...</p>
      ) : session && isAuthorized ? (
        <div>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">{editingProduct ? "Edit product" : "Add a product"}</h2>
            <span className="text-sm text-slate-600">{session.email}</span>
            {session.role === "super_admin" && (
              <Link href="/admin/accounts" className="text-sm font-semibold text-amber-800 underline">
                Manage admin accounts
              </Link>
            )}
            <button
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-50"
              type="button"
              disabled={busy}
              onClick={handleSignOut}
            >
              Sign out
            </button>
          </div>
          <form
            id="admin-product-form"
            key={editingProduct?.id ?? "new"}
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={handleSaveProduct}
          >
            <label className="grid gap-1 text-sm font-medium">
              Product name
              <input
                name="name"
                defaultValue={editingProduct?.name ?? ""}
                className="rounded-lg border border-slate-300 px-3 py-2"
                required
                maxLength={150}
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Price
              <input
                name="price"
                defaultValue={editingProduct?.price ?? ""}
                className="rounded-lg border border-slate-300 px-3 py-2"
                type="number"
                min="0"
                step="0.01"
                required
              />
            </label>
            <label className="grid gap-1 text-sm font-medium sm:col-span-2">
              Description
              <textarea
                name="description"
                defaultValue={editingProduct?.description ?? ""}
                className="rounded-lg border border-slate-300 px-3 py-2"
                rows={3}
                maxLength={2000}
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Stock quantity
              <input
                name="stock"
                className="rounded-lg border border-slate-300 px-3 py-2"
                type="number"
                min="0"
                step="1"
                defaultValue={editingProduct?.stock_qty ?? "0"}
                required
              />
            </label>
            {editingProduct && (
              <label className="grid gap-1 text-sm font-medium">
                Product status
                <select
                  name="is_active"
                  defaultValue={editingProduct.is_active ? "true" : "false"}
                  className="rounded-lg border border-slate-300 px-3 py-2"
                >
                  <option value="true">Active — visible in the store</option>
                  <option value="false">Inactive — hidden from the store</option>
                </select>
              </label>
            )}
            <label className="grid gap-1 text-sm font-medium">
              {editingProduct
                ? "Replace product image (optional; JPEG, PNG, WebP; source up to 25 MB, optimized to 5 MB or less)"
                : "Product image (JPEG, PNG, WebP; source up to 25 MB, optimized to 5 MB or less)"}
              <input
                name="image"
                className="rounded-lg border border-slate-300 px-3 py-2"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                required={!editingProduct}
              />
            </label>
            {editingProduct?.image_url && (
              <div className="flex items-center gap-3 text-sm text-slate-600 sm:col-span-2">
                <img src={editingProduct.image_url} alt="" className="h-12 w-12 rounded object-cover" />
                Current product image
              </div>
            )}
            <button
              className="rounded-lg bg-amber-700 px-4 py-2 font-semibold text-white disabled:opacity-50 sm:col-span-2"
              type="submit"
              disabled={busy}
            >
              {busy
                ? editingProduct
                  ? "Saving..."
                  : "Uploading..."
                : editingProduct
                  ? "Save changes"
                  : "Save product and upload image"}
            </button>
            {editingProduct && (
              <div className="flex flex-wrap gap-3 sm:col-span-2">
                <button
                  className="rounded-lg border border-slate-300 px-4 py-2 font-semibold"
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setEditingProduct(null);
                    setError("");
                    setNotice("");
                  }}
                >
                  Cancel editing
                </button>
                <button
                  className="rounded-lg border border-red-300 px-4 py-2 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                  type="button"
                  disabled={busy}
                  onClick={() => void handleDeleteProduct(editingProduct)}
                >
                  {busy ? "Deleting..." : "Delete product"}
                </button>
              </div>
            )}
          </form>

          <div className="mt-8 border-t border-slate-200 pt-6">
            <h3 className="font-semibold">Products in this store ({products.length})</h3>
            {products.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">No products are saved yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100">
                {products.map((product) => (
                  <li key={product.id} className="flex items-center gap-3 py-3">
                    {product.image_url && (
                      <img src={product.image_url} alt="" className="h-12 w-12 rounded object-cover" />
                    )}
                    <span className="flex-1">{product.name}</span>
                    <label className="sr-only" htmlFor={`product-status-${product.id}`}>
                      {product.name} status
                    </label>
                    <select
                      id={`product-status-${product.id}`}
                      value={product.is_active ? "true" : "false"}
                      disabled={busy || statusUpdatingProductId !== null}
                      onChange={(event) => handleProductStatusChange(product, event.target.value === "true")}
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold disabled:cursor-wait disabled:opacity-60 ${
                        product.is_active ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                    <button
                      type="button"
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
                      disabled={busy || statusUpdatingProductId !== null}
                      onClick={() => {
                        setEditingProduct(product);
                        setError("");
                        setNotice("");
                        document.getElementById("admin-product-form")?.scrollIntoView({ behavior: "smooth" });
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                      disabled={busy || statusUpdatingProductId !== null}
                      onClick={() => void handleDeleteProduct(product)}
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : !checkingSession ? (
        <p className="text-slate-600">You are not authorized to manage products.</p>
      ) : null}
    </section>
  );
}
