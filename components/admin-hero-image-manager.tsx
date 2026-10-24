"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";

type HeroImage = {
  id: number;
  position: number;
  image_url: string;
  created_at: string;
};

type AdminHeroImageManagerProps = {
  tenantSlug: string;
};

const MAX_HERO_IMAGES = 10;

export function AdminHeroImageManager({ tenantSlug }: AdminHeroImageManagerProps) {
  const router = useRouter();
  const [images, setImages] = useState<HeroImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadImages = useCallback(async () => {
    const response = await fetch(`/api/admin/tenants/${tenantSlug}/hero-images`, { cache: "no-store" });
    const result = (await response.json()) as { images?: HeroImage[]; error?: string };
    if (response.status === 401) {
      router.replace("/admin");
      return;
    }
    if (!response.ok) throw new Error(result.error ?? "Could not load hero images.");
    setImages(result.images ?? []);
  }, [router, tenantSlug]);

  useEffect(() => {
    let active = true;
    void Promise.resolve()
      .then(loadImages)
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Could not load hero images.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadImages]);

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (files.length === 0) return;
    if (images.length + files.length > MAX_HERO_IMAGES) {
      setError(`A store can have up to ${MAX_HERO_IMAGES} hero images. Remove an image or choose fewer files.`);
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");
    let uploaded = 0;
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append("image", file);
        const response = await fetch(`/api/admin/tenants/${tenantSlug}/hero-images`, {
          method: "POST",
          body: formData,
        });
        const result = (await response.json()) as { error?: string };
        if (!response.ok) throw new Error(result.error ?? `Could not upload ${file.name}.`);
        uploaded += 1;
      }

      setNotice(`${uploaded} hero image${uploaded === 1 ? "" : "s"} uploaded.`);
      await loadImages();
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "Could not upload hero images.";
      setError(uploaded ? `${uploaded} image${uploaded === 1 ? "" : "s"} uploaded before the error. ${message}` : message);
      if (uploaded) await loadImages();
    } finally {
      setBusy(false);
    }
  }

  async function saveOrder(nextImages: HeroImage[]) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/tenants/${tenantSlug}/hero-images`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageIds: nextImages.map((image) => image.id) }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not reorder hero images.");
      setImages(nextImages);
      setNotice("Hero image order saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not reorder hero images.");
      await loadImages();
    } finally {
      setBusy(false);
    }
  }

  async function moveImage(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= images.length) return;
    const next = [...images];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    await saveOrder(next);
  }

  async function deleteImage(image: HeroImage) {
    if (!window.confirm("Delete this hero image from the storefront and storage?")) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `/api/admin/tenants/${tenantSlug}/hero-images?id=${image.id}`,
        { method: "DELETE" },
      );
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not delete hero image.");
      setImages((current) => current.filter((item) => item.id !== image.id));
      setNotice("Hero image deleted.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete hero image.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8 space-y-8">
      <Link href="/admin/products" className="text-sm font-semibold text-amber-800 underline">
        Back to product administration
      </Link>

      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{notice}</p>}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Storefront hero images</h2>
        <p className="mt-2 text-sm text-slate-600">
          Upload up to {MAX_HERO_IMAGES} JPEG, PNG, or WebP images. Each image can be up to 4 MB.
          The storefront rotates through them automatically.
        </p>
        <label className="mt-5 grid max-w-xl gap-2 text-sm font-medium">
          Add multiple images
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={busy || images.length >= MAX_HERO_IMAGES}
            onChange={handleUpload}
            className="rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-50"
          />
        </label>
        <p className="mt-2 text-xs text-slate-500">{images.length} of {MAX_HERO_IMAGES} images used.</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Current images</h2>
        {loading ? (
          <p className="mt-4 text-slate-600">Loading hero images...</p>
        ) : images.length === 0 ? (
          <p className="mt-4 text-slate-600">No custom hero images yet. The default storefront image will be shown.</p>
        ) : (
          <ol className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {images.map((image, index) => (
              <li key={image.id} className="overflow-hidden rounded-xl border border-slate-200">
                <img src={image.image_url} alt={`Storefront hero ${index + 1}`} className="h-44 w-full object-cover" />
                <div className="flex items-center justify-between gap-2 p-3">
                  <span className="text-sm font-medium">Image {index + 1}</span>
                  <div className="flex gap-2">
                    <button type="button" disabled={busy || index === 0} onClick={() => void moveImage(index, -1)} aria-label={`Move image ${index + 1} up`} className="rounded border px-2 py-1 disabled:opacity-40">↑</button>
                    <button type="button" disabled={busy || index === images.length - 1} onClick={() => void moveImage(index, 1)} aria-label={`Move image ${index + 1} down`} className="rounded border px-2 py-1 disabled:opacity-40">↓</button>
                    <button type="button" disabled={busy} onClick={() => void deleteImage(image)} className="rounded border border-red-200 px-2 py-1 text-red-700 disabled:opacity-40">Delete</button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
